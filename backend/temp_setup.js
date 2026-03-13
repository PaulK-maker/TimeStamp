const mongoose = require('mongoose');
const Staff = require('./models/staff');
require('dotenv').config();

async function setup() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const email = 'admin@example.com';
        await Staff.deleteOne({ email });
        const admin = new Staff({
            firstName: 'Admin',
            lastName: 'User',
            email: email,
            password: 'Admin123!',
            role: 'admin'
        });
        await admin.save();
        console.log('Admin user created/updated');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

setup();