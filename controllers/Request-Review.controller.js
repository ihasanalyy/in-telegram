const { encryption, decryption } = require('../configurations/Encryption');
const Account = require('../models/Account.model');
const PaymentRequest = require('../models/Request-Payment.model');
const RequestReview = require('../models/RequestReview.model');
const { addNotification } = require('../utils/generateNotification')
const { sendPrivateMessage } = require('../utils/websocket');

module.exports.buyerToSellerReview = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { comment, rating, type, request_id } = data;

        if (!comment || !rating || !type || !request_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const paymentRequest = await PaymentRequest.findOne({ _id: request_id, status: "completed" });

        if (paymentRequest) {
            const seller = paymentRequest.sender;
            const buyer = paymentRequest.receiver;
            const existingReview = await RequestReview.findOne({
                review_type: "buyer_to_seller",
                buyer: buyer,
                request: request_id,
            });

            if (existingReview) {
                let error = await encryption({
                    status: false,
                    message: "A review with the same buyer already exists."
                });
                return res.status(400).send(error);
            }
            const newReview = {
                comment,
                request_type: type,
                review_type: "buyer_to_seller",
                rating,
                seller: seller,
                buyer: buyer,
                request: paymentRequest,
            };

            RequestReview.create(newReview)
                .then(async (reviewCreated) => {
                    // newly created reveiw
                    const reviewId = reviewCreated._id;

                    PaymentRequest.updateOne({ _id: request_id }, { buyer_comment: reviewId })
                        .then(async () => {
                            const notificationObj = {
                                title: 'Request Review Notification',
                                desc: 'Review added successfully.',
                                type: 'request_review',
                                status: 'unread',
                                from: buyer,
                                to: seller,
                                link_id: request_id,
                            }

                            addNotification(notificationObj)
                            sendPrivateMessage(seller, "Review added successfully.!")
                            let ciphertext = await encryption({
                                status: true,
                                message: "Review created successfully.",
                                review: reviewCreated
                            });
                            res.status(200).send(ciphertext);
                        })
                        .catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while updating the PaymentRequest."
                            });
                            res.status(400).send(error);
                        });
                })
                .catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while creating the review."
                    });
                    res.status(400).send(error);
                });
        } else {
            let error = await encryption({
                status: false,
                message: "Payment request not found or not completed!"
            });
            res.status(404).send(error);
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.sellerToBuyerReview = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { comment, rating, type, request_id } = data
        if (!comment || !rating || !type || !request_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const paymentRequest = await PaymentRequest.findOne({ _id: request_id, status: "completed" });

        if (paymentRequest) {
            const seller = paymentRequest.sender;
            const buyer = paymentRequest.receiver;
            const buyer_comment_id = paymentRequest.buyer_comment;

            const existingReview = await RequestReview.findOne({
                review_type: "seller_to_buyer",
                seller: seller,
                request: request_id,
            });

            if (existingReview) {
                let error = await encryption({
                    status: false,
                    message: "A review with the same seller and request id already exists."
                });
                return res.status(400).send(error);
            }

            const newReview = {
                comment,
                review_type: "seller_to_buyer",
                request_type: type,
                rating,
                seller: seller,
                buyer: buyer,
                request: paymentRequest,
                linked_review: buyer_comment_id,

            };

            RequestReview.create(newReview)
                .then(async (reviewCreated) => {

                    // Update the linked_review in the found Review based on buyer_comment_id
                    RequestReview.updateOne(
                        { _id: buyer_comment_id },
                        { linked_review: reviewCreated._id }
                    )
                        .then(() => {
                            // Update the PaymentRequest with the seller_comment
                            PaymentRequest.updateOne(
                                { _id: request_id },
                                { seller_comment: reviewCreated._id }
                            )
                                .then(async () => {
                                    let ciphertext = await encryption({
                                        status: true,
                                        message: "Review created successfully.",
                                        review: reviewCreated
                                    });
                                    res.status(200).send(ciphertext);
                                    const notificationObj = {
                                        title: 'Request Review Notification',
                                        desc: 'Review added successfully.',
                                        type: 'request_review',
                                        status: 'unread',
                                        from: seller,
                                        to: buyer,
                                        link_id: request_id,
                                    }

                                    addNotification(notificationObj)
                                    sendPrivateMessage(buyer, "Review has been added.")
                                })
                                .catch(async () => {
                                    let error = await encryption({
                                        status: false,
                                        message: "Something went wrong while updating the PaymentRequest."
                                    });
                                    res.status(400).send(error);
                                });
                        })
                        .catch(async () => {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while updating the linked_review."
                            });
                            res.status(400).send(error);
                        });
                })
                .catch(async () => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while creating the review."
                    });
                    res.status(400).send(error);
                });
        } else {
            let error = await encryption({
                status: false,
                message: "Payment request not found or not completed!"
            });
            res.status(404).send(error);
        }
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.sellerToBuyerReply = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { reply, buyer_comment_id } = data;
        if (!reply || !buyer_comment_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }
        const buyerReview = await RequestReview.findOne({ _id: buyer_comment_id, review_type: "buyer_to_seller" });

        if (buyerReview) {
            RequestReview.updateOne(
                { _id: buyer_comment_id },
                { reply: reply }
            ).then(async () => {
                let ciphertext = await encryption({
                    status: true,
                    message: "Reply added successfully.",
                });
                res.status(200).send(ciphertext);
                const notificationObj = {
                    title: 'Request Review Notification',
                    desc: 'Reply has been added.',
                    type: 'request_review',
                    status: 'unread',
                    from: buyerReview.seller,
                    to: buyerReview.buyer,
                    link_id: buyer_comment_id,
                }

                addNotification(notificationObj)
                sendPrivateMessage(buyerReview.buyer, "Review added successfully.!")
            })
                .catch(async () => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while adding the Reply."
                    });
                    res.status(400).send(error);
                });
        }
        else {
            let error = await encryption({
                status: false,
                message: "Buyer comment could not be found!"
            });
            res.status(400).send(error);
        }

    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.getReviewsBySeller = async (req, res) => {
    let { seller_id, limit, skip } = req.params;

    if (skip < 1) { skip = 1 }
    skip = (skip - 1) * 50
    if (limit > 100) {
        limit = 100;
    }
    try {
        if (!seller_id) {
            let error = await encryption({
                status: false,
                message: "Seller ID is required"
            });
            return res.status(400).send(error);
        }

        const reviews = await RequestReview.find({
            seller: seller_id,
            review_type: "seller_to_buyer",
            delete_status: false
        }).sort({ createdAt: -1 }).skip(skip).limit(limit)
            .populate([
                {
                    path: 'buyer',
                    select: 'username email',
                    populate: ([
                        { path: 'user', select: 'first_name last_name' },
                        { path: 'company', select: 'company_name' }
                    ])
                },
                {
                    path: 'seller',
                    select: 'username email',
                    populate: ([
                        { path: 'user', select: 'first_name last_name' },
                        { path: 'company', select: 'company_name' }
                    ])
                }]);

        if (reviews.length === 0) {
            let error = await encryption({
                status: false,
                message: "No reviews found for the specified seller."
            });
            return res.status(404).send(error);
        }

        const reviewsCount = await RequestReview.countDocuments({
            buyer: seller_id,
            review_type: "seller_to_buyer",
            delete_status: false
        });

        let ciphertext = await encryption({
            status: true,
            message: "Review created successfully.",
            reviews: reviews,
            reviewsCount
        });
        return res.status(200).send(ciphertext);
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error"
        });
        res.status(500).send(error);
    }
};

module.exports.getReviewsByRequest = async (req, res) => {
    const { request_id } = req.params;
    try {
        if (!request_id) {
            let error = await encryption({
                status: false,
                message: "Request ID is required"
            });
            return res.status(400).send(error);
        }

        const reviews = await RequestReview.find({
            request: request_id,
            delete_status: false
        }).populate({
            path: 'buyer',
            select: 'username email',
            populate: ([
                { path: 'user', select: 'first_name last_name' },
                { path: 'company', select: 'company_name' }
            ])
        })
            .populate({
                path: 'seller',
                select: 'username email',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            });

        if (reviews.length === 0) {
            let error = await encryption({
                status: false,
                message: "No reviews found for the specified request."
            });
            return res.status(404).send(error);
        }

        const allReviews = await RequestReview.find({
            seller: reviews[0].seller._id,
            review_type: "seller_to_buyer",
            delete_status: false
        })

        const allReviewsCount = await RequestReview.countDocuments({
            seller: reviews[0].seller._id,
            review_type: "seller_to_buyer",
            delete_status: false
        })


        const sumOfRatings = allReviews.reduce((sum, review) => sum + review.rating, 0);

        const averageRating = allReviews?.length > 0 ? sumOfRatings / allReviews?.length : 0;

        const rating = allReviews.map((review) => review.rating)

        let ciphertext = await encryption({
            status: true,
            message: "Review found successfully.",
            reviews: reviews,
            count: allReviewsCount,
            averageRating
        });
        return res.status(200).send(ciphertext);
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error"
        });
        res.status(500).send(error);
    }
};

module.exports.updateReview = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { comment, rating, review_id } = data

        if (!comment || !review_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        RequestReview.findByIdAndUpdate(review_id, { comment, rating }, { new: true }).then(async (review) => {
            let ciphertext = await encryption({
                status: true,
                message: "Review updated successfully",
                updatedReview: review,
            });
            return res.status(200).send(ciphertext);
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting review"
            });
            return res.status(400).send(error);
        })

    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.updateReply = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { reply, review_id } = data

        if (!reply || !review_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        RequestReview.findByIdAndUpdate(review_id, { reply }, { new: true }).then(async (review) => {
            let ciphertext = await encryption({
                status: true,
                message: "Reply updated successfully",
                updatedReview: review,
            });
            return res.status(200).send(ciphertext);
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting review"
            });
            return res.status(400).send(error);
        })

    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.deleteReview = async (req, res) => {
    try {
        let review_id = req.params.review_id;

        if (!review_id) {
            let error = await encryption({
                status: false,
                message: "Review ID is required"
            });
            return res.status(400).send(error);
        }

        RequestReview.findByIdAndUpdate(review_id, { delete_status: true }, { new: true }).then(async (deletedReview) => {
            let error = await encryption({
                status: true,
                message: "Review Delete Successfully!",
                deletedReview: deletedReview
            })
            return res.status(200).send(error)
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while deleting the review!"
            })
            return res.status(404).send(error)
        })
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal Server Error!"
        });
        res.status(500).send(error)
    }
}

module.exports.deleteReply = async (req, res) => {
    try {
        let review_id = req.params.review_id;

        if (!review_id) {
            let error = await encryption({
                status: false,
                message: "Review ID is required"
            });
            return res.status(400).send(error);
        }

        RequestReview.findByIdAndUpdate(review_id, { reply: "" }, { new: true }).then(async (deletedReply) => {
            let error = await encryption({
                status: true,
                message: "Reply Delete Successfully!",
                deletedReview: deletedReply
            })
            return res.status(200).send(error)
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while deleting the reply!"
            })
            return res.status(404).send(error)
        })
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal Server Error!"
        });
        res.status(500).send(error)
    }
}





