var express = require('express');
var router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const MessageModel = require('../schemas/messages');
const { CheckLogin } = require('../utils/authHandler');

const uploadDirectory = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
        cb(null, `${timestamp}_${safeName}`);
    }
});

const upload = multer({ storage });

// 1. POST "/" - Gửi tin nhắn mới
router.post('/', CheckLogin, async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const { to, type, text } = req.body;

        const newMessage = new MessageModel({
            from: currentUserId,
            to: to,
            messageContent: {
                type: type, // 'file' hoặc 'text'
                text: text  // path file hoặc nội dung text
            }
        });

        await newMessage.save();
        res.status(201).send(newMessage);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

// 1b. POST "/upload" - Gửi tin nhắn file (form-data file)
router.post('/upload', CheckLogin, upload.single('file'), async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const { to } = req.body;

        if (!req.file) {
            return res.status(400).send({ message: 'Vui lòng gửi file bằng field name "file"' });
        }
        if (!to) {
            return res.status(400).send({ message: 'Chưa truyền to (ID người nhận)' });
        }

        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        const newMessage = new MessageModel({
            from: currentUserId,
            to: to,
            messageContent: {
                type: 'file',
                text: fileUrl
            }
        });

        await newMessage.save();
        res.status(201).send(newMessage);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

// 2. GET "/:userID" - Lấy lịch sử chat giữa 2 người
router.get('/:userID', CheckLogin, async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const partnerId = req.params.userID;

        const messages = await MessageModel.find({
            $or: [
                { from: currentUserId, to: partnerId },
                { from: partnerId, to: currentUserId }
            ]
        }).sort({ createdAt: 1 }); // Sắp xếp theo thời gian tăng dần (cũ đến mới)

        res.send(messages);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

// 3. GET "/" - Lấy tin nhắn cuối cùng của mỗi cuộc hội thoại (Inbox list)
router.get('/', CheckLogin, async (req, res) => {
    try {
        const currentUserId = req.user._id;

        const chatList = await MessageModel.aggregate([
            // Tìm tất cả tin nhắn liên quan đến user hiện tại
            { $match: { $or: [{ from: currentUserId }, { to: currentUserId }] } },
            // Sắp xếp mới nhất lên trên
            { $sort: { createdAt: -1 } },
            // Nhóm theo cặp hội thoại (người mình đang chat cùng)
            {
                $group: {
                    _id: {
                        $cond: [ { $eq: ["$from", currentUserId] }, "$to", "$from" ]
                    },
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            // Join với bảng users để lấy tên người chat cùng
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "partnerInfo"
                }
            },
            { $unwind: "$partnerInfo" },
            { $project: { "partnerInfo.password": 0 } } // Ẩn password
        ]);

        res.send(chatList);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

module.exports = router;