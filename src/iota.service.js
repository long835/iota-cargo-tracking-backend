// src/services/iota.service.js (Phiên bản dùng @iota/client)

const { Client } = require('@iota/client');
require('dotenv').config();

// Khởi tạo IOTA Client
const client = new Client({ nodes: [process.env.IOTA_NODE_URL] });

/**
 * 1. Tạo ID duy nhất cho kiện hàng.
 * @returns {string} ID duy nhất dựa trên thời gian.
 */
async function createPackageID() {
    // Tạo ID tạm thời (Ví dụ: PKG-17022025-a7x9c2)
    const packageID = `PKG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    return packageID;
}

/**
 * 2. Lưu trạng thái (Audit Trail) của kiện hàng lên Tangle (Indexation Message).
 * @param {string} packageID - ID duy nhất của kiện hàng.
 * @param {string} status - Trạng thái mới.
 * @param {string} location - Vị trí hiện tại.
 * @returns {object} Thông tin giao dịch.
 */
async function trackPackageUpdate(packageID, status, location) {
    const auditData = {
        timestamp: new Date().toISOString(),
        packageID: packageID,
        status: status,
        location: location,
    };

    // Chuyển JSON thành dữ liệu nhị phân
    const dataPayload = Buffer.from(JSON.stringify(auditData), 'utf8');
    // Index để dễ dàng truy vấn toàn bộ lịch sử
    const index = `AUDIT_TRAIL_${packageID.substring(0, 20)}`; 

    try {
        // Gửi Indexation Message
        const message = await client.message()
            .withPayload({
                type: 'Indexation',
                index: index,
                data: dataPayload.toString('hex'),
            })
            .finish(); // Indexation Message không cần ký

        console.log(`Gửi thành công! Message ID: ${message.messageId}`);

        return {
            messageId: message.messageId,
            data: auditData,
            explorerUrl: `${process.env.IOTA_NODE_URL.replace('api', 'explorer')}/message/${message.messageId}`
        };

    } catch (error) {
        console.error("Lỗi khi gửi lên Tangle:", error);
        throw new Error("Không thể ghi dữ liệu lên Tangle.");
    }
}

/**
 * 3. Đọc toàn bộ lịch sử Audit Trail của kiện hàng.
 */
async function getAuditHistory(packageID) {
    const index = `AUDIT_TRAIL_${packageID.substring(0, 20)}`;

    try {
        // Tìm kiếm Message IDs dựa trên Index
        const messageIdsResponse = await client.messageFind(index);
        const messageIds = messageIdsResponse.messages;

        const history = [];

        // Lấy nội dung từng Message
        for (const id of messageIds) {
            const message = await client.getMessage().data(id);
            const payload = message.payload;

            if (payload && payload.type === 2) { // Indexation Payload type
                const dataHex = payload.data;
                const dataJson = Buffer.from(dataHex, 'hex').toString('utf8');

                try {
                    const data = JSON.parse(dataJson);
                    history.push({
                        messageId: id,
                        timestamp: data.timestamp,
                        status: data.status,
                        location: data.location
                    });
                } catch (e) {
                    // Bỏ qua lỗi parsing JSON
                }
            }
        }

        return history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    } catch (error) {
        if (error.toString().includes('not found')) {
            return [];
        }
        console.error("Lỗi khi đọc lịch sử từ Tangle:", error);
        throw new Error("Không thể đọc lịch sử từ Tangle.");
    }
}

module.exports = {
    createPackageID,
    trackPackageUpdate,
    getAuditHistory
};