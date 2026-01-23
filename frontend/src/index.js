import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter, useNavigate } from "react-router-dom";
import App from "./App";
import "./index.css";

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

function ClerkProviderWithRouter() {
	const navigate = useNavigate();

	return (
		<ClerkProvider
			publishableKey={publishableKey}
			navigate={(to) => navigate(to)}
		>
			<App />
		</ClerkProvider>
	);
}

root.render(
	<BrowserRouter>
		<ClerkProviderWithRouter />
	</BrowserRouter>
);