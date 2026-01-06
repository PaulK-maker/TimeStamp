let tokenProvider = null;

export function setAuthTokenProvider(provider) {
	tokenProvider = typeof provider === "function" ? provider : null;
}

export async function getAuthToken() {
	if (tokenProvider) {
		try {
			const token = await tokenProvider();
			if (token) return token;
		} catch (err) {
			// Ignore provider errors and fall back to legacy token.
		}
	}

	return localStorage.getItem("token");
}
