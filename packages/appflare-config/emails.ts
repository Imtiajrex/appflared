import { Resend } from "resend";

type User = {
	createdAt: Date;
	id: string;
	updatedAt: Date;
	emailVerified: boolean;
	name: string;
	email?: string;
	image?: string;
};
const resend = () => {
	return new Resend(process.env.RESEND_KEY);
};
export const sendResetEmail = async (data: {
	user: User;
	url: string;
	token: string;
}) => {
	await resend().emails.send({
		from: "noreply@anglershield.com",
		to: data.user.email,
		subject: "Reset Password",
		html: `
    <p>Click the link to reset your password</p>
    <a href="${data.url}">Reset Password</a>
    `,
	});
};

export const sendVerificationEmail = async (data: {
	user: User;
	url: string;
	token: string;
}) => {
	await resend().emails.send({
		from: "noreply@anglershield.com",
		to: data.user.email,
		subject: "Verify Email",
		html: `
    <p>Click the link to verify your email</p>
    <a href="${data.url}">Verify Email</a>
    `,
	});
};
