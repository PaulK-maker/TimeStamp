import React from "react";
import { SignUp } from "@clerk/clerk-react";

export default function SignUpPage() {
  const origin = window.location.origin;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <SignUp
        routing="path"
        path="/sign-up"
        forceRedirectUrl="/post-sign-in"
        appearance={{
          layout: {
            termsPageUrl: `${origin}/terms`,
            privacyPageUrl: `${origin}/privacy`,
          },
        }}
      />
    </div>
  );
}
