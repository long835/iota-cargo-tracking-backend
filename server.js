// server.js
const express = require('express');
const { createPackageID, trackPackageUpdate, getAuditHistory } = require('./src/services/iota.service');
require('dotenv').config();

const app = express(); // <-- Dòng này phải đúng
const PORT = process.env.PORT || 3000; 
// ...

app.use(express.json());

// -----------------------------------------------------------------
// ENDPOINT 1: Tạo Kiện Hàng Mới (và ID)
// POST /api/package
// -----------------------------------------------------------------
app.post('/api/package', async (req, res) => {
    try {
        const packageID = await createPackageID();

        // Ghi lại trạng thái khởi tạo lên Audit Trail
        const initialStatus = "CREATED";
        const initialLocation = req.body.initialLocation || "Warehouse 001";

        const trackingResult = await trackPackageUpdate(packageID, initialStatus, initialLocation);

        res.status(201).json({
            message: "Kiện hàng và ID đã được tạo thành công. Bắt đầu tracking.",
            packageID: packageID,
            initialTracking: trackingResult,
            note: "ID này là khóa để truy vấn lịch sử Audit Trail trên Tangle."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});


// -----------------------------------------------------------------
// ENDPOINT 2: Cập nhật Trạng thái Logistics (Ghi Audit Trail)
// POST /api/package/track/:id
// -----------------------------------------------------------------
app.post('/api/package/track/:id', async (req, res) => {
    const packageID = req.params.id;
    const { status, location } = req.body;

    if (!status || !location) {
        return res.status(400).json({ error: "Thiếu status hoặc location trong body request." });
    }

    try {
        const trackingResult = await trackPackageUpdate(packageID, status, location);

        res.status(200).json({
            message: "Đã ghi trạng thái mới lên IOTA Audit Trail.",
            packageID: packageID,
            trackingDetails: trackingResult
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});


// -----------------------------------------------------------------
// ENDPOINT 3: Đọc Lịch sử Audit Trail (Đọc từ Tangle)
// GET /api/package/history/:id
// -----------------------------------------------------------------
app.get('/api/package/history/:id', async (req, res) => {
    const packageID = req.params.id;

    try {
        const history = await getAuditHistory(packageID);

        res.status(200).json({
            packageID: packageID,
            history: history
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Khởi động Server
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`IOTA Node: ${process.env.IOTA_NODE_URL}`);
});