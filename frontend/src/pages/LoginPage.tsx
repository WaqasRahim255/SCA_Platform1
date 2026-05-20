import { SignIn } from "@clerk/clerk-react";

export function LoginPage() {
  return (
    <SignIn
      path="/login"
      routing="path"
      signUpUrl="/signup"
      forceRedirectUrl="/"
      signUpForceRedirectUrl="/"
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
