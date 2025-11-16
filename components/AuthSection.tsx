"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, LogIn, User, LogOut, Info, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

interface AuthSectionProps {
  userData: any;
  onAuthChange: () => void;
}

export default function AuthSection({ userData, onAuthChange }: AuthSectionProps) {
  const [showDeveloperInfo, setShowDeveloperInfo] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Check for success parameter in URL when authenticated status changes or on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("success") && userData?.authenticated) {
      setShowSuccessMessage(true);
      // Hide success message after 5 seconds
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else if (!userData?.authenticated) {
      // Hide success message if user logs out
      setShowSuccessMessage(false);
    }
  }, [userData?.authenticated]);

  const handleLogin = () => {
    window.location.href = "/auth/login";
  };

  const handleLogout = async () => {
    window.location.href = "/auth/logout";
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Authentication Status</CardTitle>
              <CardDescription>
                {userData?.authenticated
                  ? "You are authenticated with ID-porten"
                  : "Start by authenticating with ID-porten"}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={userData?.authenticated ? "default" : "secondary"}
            className={`${
              userData?.authenticated
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-500 hover:bg-gray-600"
            } text-white flex items-center gap-2`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                userData?.authenticated ? "bg-green-300 animate-pulse" : "bg-gray-300"
              }`}
            />
            {userData?.authenticated ? "Authenticated" : "Not Authenticated"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Success Message */}
        {showSuccessMessage && userData?.authenticated && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Successfully authenticated with ID-porten!
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                You can now access Altinn APIs and view your profile information.
              </p>
            </div>
          </div>
        )}
        
        {/* Main Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!userData?.authenticated ? (
            <Button
              onClick={handleLogin}
              size="lg"
              className="flex items-center gap-2 text-base font-semibold"
            >
              <LogIn className="h-5 w-5" />
              Login with ID-porten
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Link href="/profile">
                <Button
                  size="lg"
                  className="flex items-center gap-2 text-base font-semibold"
                >
                  <User className="h-5 w-5" />
                  View Profile & Authorization Details
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          )}
        </div>

        {/* Developer Information Toggle */}
        <div className="border-t pt-4">
          <button
            onClick={() => setShowDeveloperInfo(!showDeveloperInfo)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="h-4 w-4" />
            {showDeveloperInfo ? "Hide" : "Show"} Developer Information
          </button>

          {showDeveloperInfo && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Authentication Flow
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground ml-4">
                  <li>
                    <strong>GET /auth/login</strong> - Initiates OAuth flow, generates PKCE
                    challenge and state, redirects to ID-porten
                  </li>
                  <li>
                    <strong>GET {`{idporten}/authorize`}</strong> - Authorization request with PKCE
                    challenge
                  </li>
                  <li>
                    <strong>GET /auth/callback?code=...</strong> - Callback with authorization code
                  </li>
                  <li>
                    <strong>POST {`{idporten}/token`}</strong> - Exchange code for access token using
                    PKCE verifier
                  </li>
                  <li>
                    <strong>Cookie: altinn_session</strong> - Tokens stored in secure HTTP-only cookie
                  </li>
                </ol>
              </div>

              {userData?.authenticated && (
                <div className="pt-3 border-t">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Session Storage
                  </h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <strong>Access Token:</strong> Stored in session cookie (HTTP-only, secure)
                    </p>
                    <p>
                      <strong>ID Token:</strong> Contains user claims and authorization details
                    </p>
                    <p>
                      <strong>Refresh Token:</strong>{" "}
                      {userData?.tokenExpiresAt
                        ? "Available for token refresh"
                        : "Not available"}
                    </p>
                    <p>
                      <strong>Expires At:</strong>{" "}
                      {userData?.tokenExpiresAt
                        ? new Date(userData.tokenExpiresAt).toLocaleString()
                        : "Not set"}
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t">
                <h4 className="font-semibold text-sm mb-2">Endpoints Used</h4>
                <div className="text-xs text-muted-foreground space-y-1 font-mono">
                  <div>• /auth/login - Start authentication</div>
                  <div>• /auth/callback - Handle OAuth callback</div>
                  <div>• /auth/logout - End session</div>
                  <div>• /api/user - Get current user info</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

