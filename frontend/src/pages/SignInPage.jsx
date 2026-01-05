import React from "react";
import { SignIn } from "@clerk/clerk-react";

export default function SignInPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <SignIn routing="path" path="/sign-in" redirectUrl="/post-sign-in" />
    </div>
  );
}
