import { SignUp } from "@clerk/clerk-react";

export function SignupPage() {
  return (
    <SignUp
      path="/signup"
      routing="path"
      signInUrl="/login"
      forceRedirectUrl="/"
      signInForceRedirectUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#00A878",
          colorBackground: "#0A1628",
          colorText: "#FFFFFF",
          colorInputBackground: "#10213A",
          colorInputText: "#FFFFFF",
        },
      }}
    />
  );
}
