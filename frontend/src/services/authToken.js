let tokenProvider = null;
let lastAuthTokenError = null;

export function setAuthTokenProvider(provider) {
	tokenProvider = typeof provider === "function" ? provider : null;
	if (!tokenProvider) {
		lastAuthTokenError = null;
	}
}

export function getLastAuthTokenError() {
	return lastAuthTokenError;
}

export function clearLastAuthTokenError() {
	lastAuthTokenError = null;
}

export async function getAuthToken() {
	if (tokenProvider) {
		try {
			const token = await tokenProvider();
			lastAuthTokenError = null;
			return token;
		} catch (err) {
			lastAuthTokenError = err;
			// If Clerk is in control, don't fall back to legacy storage.
			return null;
		}
	}

	return localStorage.getItem("token");
}
