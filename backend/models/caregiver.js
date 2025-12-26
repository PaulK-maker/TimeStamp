const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const caregiverSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // hide password by default
    },
    role: {
      type: String,
      enum: ["caregiver", "admin"],
      default: "caregiver",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before save
// caregiverSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();

//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

module.exports =
  mongoose.models.Caregiver ||
  mongoose.model("Caregiver", caregiverSchema);