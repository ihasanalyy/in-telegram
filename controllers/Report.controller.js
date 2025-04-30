const { encryption, decryption } = require('../configurations/Encryption');
const Account = require('../models/Account.model');
const Report = require('../models/Report.model')
const Transaction = require('../models/Transaction.model')
const mongoose = require('mongoose');
const { addNotificationAdmin, addNotification } = require('../utils/generateNotification');

module.exports.createReport = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { from, to } = req.params
        const { note, reason } = data;
        if (!from || !to || !note) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }
        if (!mongoose.Types.ObjectId.isValid(from) || !mongoose.Types.ObjectId.isValid(to)) {
            let error = await encryption({
                status: false,
                message: "Invalid IDs found!"
            });
            return res.status(400).send(error);
        }
        const reportFrom = await Account.findOne({ $and: [{ _id: from }, { active: true }] });
        const reportTo = await Account.findOne({ $and: [{ _id: to }, { active: true }] });

        const reportObj = {
            from, to, desc: note, reason, status: "new", referral: "",
        }

        if (reportFrom.parentId || reportTo.parentId) {
            if (reportFrom.parentId && reportTo._id) {
                if (reportFrom.parentId.toString() === reportTo._id.toString()) {
                    reportObj.referral = "referred"
                }
            }
            if (reportTo.parentId && reportFrom._id) {
                if (reportTo.parentId.toString() === reportFrom._id.toString()) {
                    reportObj.referral = "parent"
                }
            }
        }
        if (!reportFrom) {
            let error = await encryption({
                status: false,
                message: "User who is reporting is not found!"
            });
            return res.status(400).send(error);
        }

        if (!reportTo) {
            let error = await encryption({
                status: false,
                message: "User who is being reported is not found!"
            });
            return res.status(400).send(error);
        }

        if (reportFrom === reportTo) {
            let error = await encryption({
                status: false,
                message: "From and To are both same"
            });
            return res.status(400).send(error);
        }

        Report.create(reportObj).then(async (createdReport) => {

            const notificationObj = {
                title: 'Report Notification',
                desc: 'Report has been submitted',
                type: 'report',
                status: 'unread',
                from,
                to,
                link_id: createdReport._id,
            }

            addNotificationAdmin(notificationObj)

            let ciphertext = await encryption({
                status: true,
                message: "Report added successfully.",
                report: createdReport
            });
            res.status(200).send(ciphertext);
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while creating report"
            });
            return res.status(400).send(error);
        })


    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.updateReportStatus = async (req, res) => {
    try {
        let data = await decryption(req.body.data);

        const report_id = req.params.report_id;
        const { newStatus } = data;

        if (!report_id || !newStatus) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const report = await Report.findById(report_id);

        if (!report) {
            let error = await encryption({
                status: false,
                message: "Report not found for the specified ID."
            });
            return res.status(404).send(error);
        }

        report.status = newStatus;

        report.save().then(async (updatedReport) => {
            const notificationObj = {
                title: 'Report Notification',
                desc: `Your report has been set to ${newStatus} state`,
                type: 'report',
                status: 'unread',
                from: report.to,
                to: report.from,
                link_id: report._id,
            }

            addNotification(notificationObj)
            let ciphertext = await encryption({
                status: true,
                message: "Report status updated successfully.",
                report: updatedReport
            });
            res.status(200).send(ciphertext);
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while updating the report status."
            });
            res.status(400).send(error);
        });

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.getReports = async (req, res) => {
    try {
        const allReports = await Report.find();
        let ciphertext = await encryption({
            status: true,
            message: "All reports",
            reports: allReports
        });

        res.status(200).send(ciphertext);
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
}

// module.exports.getAllReports = async (req, res) => {
//     try {
//         const reports = await Report.aggregate([
//             {
//                 $lookup: {
//                     from: 'transactions',
//                     let: { fromAccountId: '$from', toAccountId: '$to' },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: {
//                                     $or: [
//                                         {
//                                             $and: [
//                                                 { $eq: ['$sender', '$$fromAccountId'] },
//                                                 { $eq: ['$receiver', '$$toAccountId'] }
//                                             ]
//                                         },
//                                         {
//                                             $and: [
//                                                 { $eq: ['$sender', '$$toAccountId'] },
//                                                 { $eq: ['$receiver', '$$fromAccountId'] }
//                                             ]
//                                         }
//                                     ]
//                                 }
//                             }
//                         },
//                         {
//                             $project: {
//                                 _id: 1,
//                                 // sender: '$sender',
//                                 // receiver: '$receiver',
//                                 // amount: '$amount',
//                                 // service_type: '$service_type',
//                                 // createdAt: '$createdAt'
//                             }
//                         }
//                     ],
//                     as: 'transactions'
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'request_reviews',
//                     let: { buyerAccountId: '$from', sellerAccountId: '$to' },
//                     pipeline: [
//                         {
//                             $match: {
//                                 $expr: {
//                                     $or: [
//                                         {
//                                             $and: [
//                                                 { $eq: ['$buyer', '$$buyerAccountId'] },
//                                                 { $eq: ['$seller', '$$sellerAccountId'] }
//                                             ]
//                                         },
//                                         {
//                                             $and: [
//                                                 { $eq: ['$buyer', '$$sellerAccountId'] },
//                                                 { $eq: ['$seller', '$$buyerAccountId'] }
//                                             ]
//                                         }
//                                     ]
//                                 }
//                             }
//                         },
//                         {
//                             $project: {
//                                 _id: 1,
//                                 // comment: '$comment',
//                                 // request_type: '$request_type',
//                                 // review_type: '$review_type',
//                                 // rating: '$rating',
//                                 // linked_review: '$linked_review',
//                                 // buyer: '$buyer',
//                                 // seller: '$seller',
//                                 // request: '$request',
//                                 // reply: '$reply'
//                             }
//                         }
//                     ],
//                     as: 'reviews'
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'login_histories',
//                     localField: 'from',
//                     foreignField: 'account',
//                     as: 'from_sessions'
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'login_histories',
//                     localField: 'to',
//                     foreignField: 'account',
//                     as: 'to_sessions'
//                 }
//             },
//             {
//                 $addFields: {
//                     referral: {
//                         $cond: {
//                             if: {
//                                 $or: [
//                                     { $eq: ['$from.parentId', '$to._id'] },
//                                     { $eq: ['$to.parentId', '$from._id'] },
//                                 ]
//                             },
//                             then: true,
//                             else: false
//                         }
//                     }
//                 }
//             },

//             {
//                 $project: {
//                     _id: 1,
//                     from: '$from',
//                     to: '$to',
//                     desc: '$desc',
//                     reason: '$reason',
//                     status: '$status',
//                     createdAt: '$createdAt',
//                     transactions: 1,
//                     reviews: 1,
//                     sessions: {
//                         from: '$from_sessions._id',
//                         to: '$to_sessions._id'
//                     },
//                     referral: 1
//                 }
//             }
//         ]);

//         if (reports.length === 0) {
//             let error = await encryption({
//                 status: true,
//                 message: "Reports not found",
//             });
//             res.status(400).send(error);
//         } else {
//             let ciphertext = await encryption({
//                 status: true,
//                 message: "Report found",
//                 reports: reports
//             });
//             res.status(200).send(ciphertext);
//         }
//     } catch (err) {
//         console.log(err);
//         let error = await encryption({
//             status: false,
//             message: "Internal server error!"
//         });
//         res.status(500).send(error);
//     }
// }

module.exports.getReportsByReporter = async (req, res) => {
    try {

        const reporter_id = req.params.reporter_id;
        if (!mongoose.Types.ObjectId.isValid(reporter_id)) {
            let error = await encryption({
                status: false,
                message: "Invalid ID found!"
            });
            return res.status(400).send(error);
        }
        const reporterAccount = await Account.findOne({ $and: [{ _id: reporter_id }, { active: true }] });
        if (!reporterAccount) {
            let error = await encryption({
                status: false,
                message: "Reported not found!"
            });
            return res.status(400).send(error);
        } else {
            Report.find({ from: reporter_id }).populate({ path: "from", select: "profileImage", populate: { path: "user", select: "first_name last_name" } })
                .populate({ path: "to", select: "profileImage", populate: { path: "user", select: "first_name last_name" } }).then(async (reports) => {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Reports by reporter",
                        reports
                    });
                    return res.status(200).send(ciphertext);

                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while getting reports!"
                    });
                    return res.status(400).send(error);
                })

        }
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal Server error"
        })
        res.status(500).send(error)
    }
}

module.exports.getReportsByReported = async (req, res) => {
    try {

        const reported_id = req.params.reported_id;
        if (!mongoose.Types.ObjectId.isValid(reported_id)) {
            let error = await encryption({
                status: false,
                message: "Invalid ID found!"
            });
            return res.status(400).send(error);
        }
        const reporterAccount = await Account.findOne({ $and: [{ _id: reported_id }, { active: true }] });
        if (!reporterAccount) {
            let error = await encryption({
                status: false,
                message: "Reported not found!"
            });
            return res.status(400).send(error);
        } else {
            Report.find({ to: reported_id }).populate({ path: "from", select: "profileImage", populate: { path: "user", select: "first_name last_name" } })
                .populate({ path: "to", select: "profileImage", populate: { path: "user", select: "first_name last_name" } }).then(async (reports) => {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Reports by reporter",
                        reports
                    });
                    return res.status(200).send(ciphertext);

                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while getting reports!"
                    });
                    return res.status(400).send(error);
                })

        }
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal Server error"
        })
        res.status(500).send(error)
    }
}

module.exports.getReportByReportId = async (req, res) => {
    try {
        const report_id = req.params.report_id;

        if (!report_id || !mongoose.Types.ObjectId.isValid(report_id)) {
            let error = await encryption({
                status: false,
                message: "Invalid report ID!"
            });
            return res.status(400).send(error);
        }

        const report = await Report.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(report_id)
                }
            },
            {
                $lookup: {
                    from: 'transactions',
                    let: { fromAccountId: '$from', toAccountId: '$to' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $or: [
                                        {
                                            $and: [
                                                { $eq: ['$sender', '$$fromAccountId'] },
                                                { $eq: ['$receiver', '$$toAccountId'] }
                                            ]
                                        },
                                        {
                                            $and: [
                                                { $eq: ['$sender', '$$toAccountId'] },
                                                { $eq: ['$receiver', '$$fromAccountId'] }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                // sender: '$sender',
                                // receiver: '$receiver',
                                // amount: '$amount',
                                // service_type: '$service_type',
                                // createdAt: '$createdAt'
                            }
                        }
                    ],
                    as: 'transactions'
                }
            },
            {
                $lookup: {
                    from: 'request_reviews',
                    let: { buyerAccountId: '$from', sellerAccountId: '$to' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $or: [
                                        {
                                            $and: [
                                                { $eq: ['$buyer', '$$buyerAccountId'] },
                                                { $eq: ['$seller', '$$sellerAccountId'] }
                                            ]
                                        },
                                        {
                                            $and: [
                                                { $eq: ['$buyer', '$$sellerAccountId'] },
                                                { $eq: ['$seller', '$$buyerAccountId'] }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                comment: '$comment',
                                request_type: '$request_type',
                                review_type: '$review_type',
                                rating: '$rating',
                                linked_review: '$linked_review',
                                buyer: '$buyer',
                                seller: '$seller',
                                request: '$request',
                                reply: '$reply'
                            }
                        }
                    ],
                    as: 'reviews'
                }
            },
            {
                $lookup: {
                    from: 'login_histories',
                    localField: 'from',
                    foreignField: 'account',
                    as: 'from_sessions'
                }
            },
            {
                $lookup: {
                    from: 'login_histories',
                    localField: 'to',
                    foreignField: 'account',
                    as: 'to_sessions'
                }
            },
            {
                $project: {
                    _id: 1,
                    from: '$from',
                    to: '$to',
                    desc: '$desc',
                    reason: '$reason',
                    status: '$status',
                    createdAt: '$createdAt',
                    referral: '$referral',
                    transactions: 1,
                    reviews: 1,
                    sessions: {
                        from: '$from_sessions._id',
                        to: '$to_sessions._id'
                    },
                }
            }
        ]);

        if (report.length === 0) {
            let error = await encryption({
                status: false,
                message: "Report not found!"
            });
            res.status(404).send(error);
        } else {
            let ciphertext = await encryption({
                status: true,
                message: "Report found",
                report: report[0]
            });
            res.status(200).send(ciphertext);
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.checkReportStatus = async (req, res) => {
    try {
        const { reporter_id, username } = req.params;

        if (!reporter_id || !username) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }

        const reportedAccount = await Account.findOne({ username })

        if (!reportedAccount) {
            let error = await encryption({
                status: false,
                message: "Reported account not found!"
            });
            return res.status(400).send(error);
        }

        const existingReport = await Report.findOne({
            from: reporter_id,
            to: reportedAccount._id,
            status: { $in: ["new", "PENDING"] }
        });

        let isReported = existingReport ? true : false;

        let ciphertext = await encryption({
            status: true,
            isReported
        });
        res.status(200).send(ciphertext);

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}
