const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    from: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user', 
        required: true 
    },
    to: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user', 
        required: true 
    },
    messageContent: {
        type: { 
            type: String, 
            enum: ['file', 'text'], // Chỉ cho phép 1 trong 2 giá trị này
            required: true 
        },
        text: { 
            type: String, 
            required: true // Nếu là file thì đây là đường dẫn, nếu là text thì đây là nội dung
        }
    }
}, { timestamps: true });

module.exports = mongoose.model('message', messageSchema);