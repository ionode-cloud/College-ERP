const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Get token from header
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: '❌ No token provided' 
        });
    }

    try {
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;  // Add user to request
        next();  // Continue to route
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: '❌ Invalid token' 
        });
    }
};

module.exports = authMiddleware;
