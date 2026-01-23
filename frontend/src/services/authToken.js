let tokenProvider = null;

export function setAuthTokenProvider(provider) {
	tokenProvider = typeof provider === "function" ? provider : null;
}

export async function getAuthToken() {
	if (tokenProvider) {
		try {
			return await tokenProvider();
		} catch (err) {
			// If Clerk is in control, don't fall back to legacy storage.
			return null;
		}
	}

	return localStorage.getItem("token");
}
