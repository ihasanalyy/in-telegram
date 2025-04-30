const { encryption, decryption } = require("../configurations/Encryption");
const TransactionNotes = require("../models/Transaction-Notes.model");

module.exports.addNote = async (req, res) => {
    try {
        const data = await decryption(req.body.data)
        const { from, to, note, method, language } = data
        const newNote = new TransactionNotes({
            from,
            to,
            note,
            method,
            language
        })

        const savedNote = await newNote.save()
        const ciphertext = await encryption({
            status: true,
            message: "Note added successfully",
            data: savedNote
        })

        res.status(200).send(ciphertext)
    } catch (err) {
        console.log(err)
        const error = await encryption({
            status: true,
            message: "Internal server error",
        })

        res.status(500).send(error)
    }
}

module.exports.deleteNote = async (req, res) => {
    try {
        const { id } = req.params

        TransactionNotes.findByIdAndDelete(id).then(async (deletedNote) => {
            if (deletedNote) {
                const ciphertext = await encryption({
                    status: true,
                    message: "Note deleted successfully",
                    data: deletedNote
                })
                res.status(200).send(ciphertext)
            } else {
                const error = await encryption({
                    status: true,
                    message: "Note not found",
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err)
            const error = await encryption({
                status: true,
                message: "Internal server error",
            })
            res.status(500).send(error)
        })

    } catch (err) {
        console.log(err)
        const error = await encryption({
            status: true,
            message: "Internal server error",
        })
        res.status(500).send(error)
    }
}

module.exports.getNotes = async (req, res) => {
    try {
        const { from, to, method } = req.query;

        const query = {
            method: method,
            $or: [
                { from: 'any', to: 'any' }, // Case 1: from: any, to: any
                { from: from, to: 'any' },  // Case 2: from: specified country, to: any
                { from: 'any', to: to },    // Case 3: from: any, to: specified country
                { from: from, to: to }      // Case 4: from: specified country, to: specified country
            ]
        }

        const notes = await TransactionNotes.find(query);

        const ciphertext = await encryption({
            status: true,
            message: "Notes fetched successfully",
            notes
        })
        res.status(200).send(ciphertext)
    } catch (err) {
        console.log(err)
        const error = await encryption({
            status: true,
            message: "Internal server error",
        })
        res.status(500).send(error)
    }
}

module.exports.getAllNotes = async (req, res) => {
    try {
        const notes = await TransactionNotes.find({});
        const ciphertext = await encryption({
            status: true,
            message: "Notes fetched successfully",
            notes
        })
        res.status(200).send(ciphertext)
    } catch (err) {
        console.log(err)
        const error = await encryption({
            status: false,
            message: "Internal server error",
        })
        res.status(500).send(error)
    }
}