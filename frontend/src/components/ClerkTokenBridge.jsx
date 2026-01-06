import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setAuthTokenProvider } from "../services/authToken";

export default function ClerkTokenBridge() {
	const { isLoaded, isSignedIn, getToken } = useAuth();

	useEffect(() => {
		if (!isLoaded) return;

		setAuthTokenProvider(async () => {
			if (!isSignedIn) return null;
			return await getToken();
		});

		return () => setAuthTokenProvider(null);
	}, [isLoaded, isSignedIn, getToken]);

	return null;
}
