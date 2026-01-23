import { useLayoutEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setAuthTokenProvider } from "../services/authToken";

export default function ClerkTokenBridge() {
	const { isLoaded, isSignedIn, getToken } = useAuth();

	useLayoutEffect(() => {
		// Install ASAP so axios doesn't fall back to legacy localStorage during initial effects.
		setAuthTokenProvider(async () => {
			if (!isLoaded || !isSignedIn) return null;
			return await getToken();
		});

		// If Clerk is controlling auth, ensure legacy tokens can't override role.
		if (isLoaded && isSignedIn) {
			localStorage.removeItem("token");
			localStorage.removeItem("role");
			localStorage.removeItem("user");
			localStorage.removeItem("caregiver");
		}

		return () => setAuthTokenProvider(null);
	}, [isLoaded, isSignedIn, getToken]);

	return null;
}
