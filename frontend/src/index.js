import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";

const publishableKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
const container = document.getElementById("root");
const root = createRoot(container);

if (!publishableKey) {
	root.render(
		<div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
			<h2>Missing Clerk publishable key</h2>
			<p>
				Set <code>REACT_APP_CLERK_PUBLISHABLE_KEY</code> in <code>frontend/.env</code>
				 and restart <code>npm start</code>.
			</p>
		</div>
	);
	throw new Error(
		"Missing REACT_APP_CLERK_PUBLISHABLE_KEY. Add it to frontend/.env and restart npm start."
	);
}

root.render(
	<ClerkProvider publishableKey={publishableKey}>
		<App />
	</ClerkProvider>
);