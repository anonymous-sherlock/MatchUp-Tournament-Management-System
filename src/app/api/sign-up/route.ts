import { dbConnect } from "@/lib/dbConnection";
import { UserModel } from "@/model/user.model.js";
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server";
import { ApiResponse } from "@/helpers/ApiResponse";
import { varificationEmail } from "@/helpers/sendVarificationMail";
export async function POST(request: Request): Promise<NextResponse> {
    await dbConnect();
    try {

        //Extract user details from the request body
        const { username, email, password, adharId, phoneNumber, address } = await request.json();

        //check if user already exists
        const existingUser = await UserModel.findOne({ $or: [{ email }, { username }] })

        //generate varification code 
        const verificationCode = Math.floor(Math.random() * 900000).toString();

        //set expiry date for the varification code(1 hours)
        let expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + 1);


        let response: ApiResponse;
        let user;
        if (existingUser) {
            if (existingUser.isVerified) {
                //If user already exists then send a message to the user 
                response = {
                    success: false,
                    message: "User already exists",
                    statusCode: 409
                }

                return NextResponse.json(response);
            }
            else {
                //update the user password and verification details
                const hashedPassword = await bcrypt.hash(password, 10);

                existingUser.password = hashedPassword;
                existingUser.verifyCode = verificationCode;
                existingUser.verifyCodeExp = expiryDate;
                existingUser.isVerified = false;

                await existingUser.save();
            }
        } else {

            //hashed the password
            const hashedPassword = await bcrypt.hash(password, 10);


            //create a new user
            user = await UserModel.create({
                username,
                email,
                password: hashedPassword,
                adharId,
                phoneNumber,
                address,
                verifyCode: verificationCode,
                verifyCodeExp: expiryDate,
                isVerified: false
            });

            //check user successfully created or not
            if (!user) {
                response = {
                    success: false,
                    message: "Failed to create user",
                    statusCode: 401
                }
                return NextResponse.json(response);
            }
        }


        //send varification email notification
        const emailResponse = await varificationEmail({ email: email, username: username, otp: verificationCode });

        //if faild to send the email, return an error message

        if (!emailResponse.success) {
            response = {
                success: false,
                message: "Failed to send verification email",
                statusCode: 400
            }
            return NextResponse.json(response);
        }

        //If email send successfully , return a success message 
        response = {
            success: true,
            message: "User registered successfully. Please verify your email.",
            statusCode: 201
        }
        return NextResponse.json(response);
    } catch (signInError) {
        const response: ApiResponse = {
            success: false,
            message: "Failed to sign up",
            statusCode: 401
        }
        return NextResponse.json(response);

    }


}