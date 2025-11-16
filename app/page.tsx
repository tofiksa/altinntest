"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Code2, Users } from "lucide-react";
import AuthSection from "@/components/AuthSection";
import AuthFlowDiagram from "@/components/AuthFlowDiagram";
import UserInfoSection from "@/components/UserInfoSection";
import ApiTestSection from "@/components/ApiTestSection";
import LogsSection from "@/components/LogsSection";

interface UserData {
  authenticated: boolean;
  userInfo?: any;
  tokenExpiresAt?: number;
  authorizationDetails?: any;
  idTokenClaims?: any;
}

export default function Home() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
    
    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("success") || urlParams.has("error") || urlParams.has("logout")) {
      // After redirect, cookies might not be immediately available
      // Retry with increasing delays to ensure cookie is set
      const retryDelays = [100, 300, 500];
      retryDelays.forEach((delay, index) => {
        setTimeout(() => {
          checkAuthStatus();
        }, delay);
      });
      // Clear URL parameters after a short delay
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 1000);
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/user", {
        credentials: "include", // Ensure cookies are sent
        cache: "no-store", // Don't cache auth status
      });
      
      // Always parse JSON, even for non-200 status codes
      const data = await response.json();
      
      // The API now returns authenticated: false instead of 401
      // So we can always use the response data
      setUserData(data);
      
      if (process.env.NODE_ENV === "development") {
        console.log("[checkAuthStatus] Response:", data);
        console.log("[checkAuthStatus] Authenticated:", data.authenticated);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      setUserData({ authenticated: false });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-3xl md:text-4xl">Altinn Authentication Demo</CardTitle>
            </div>
            <CardDescription className="text-base">
              Learn and understand the OAuth 2.0 / OIDC authentication flow with ID-porten
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Product Perspective: Clear UX</span>
              </div>
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                <span>Developer Perspective: Technical Details</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auth Section - Primary Action */}
        <AuthSection userData={userData} onAuthChange={checkAuthStatus} />

        {/* Authentication Flow Diagram - Developer View */}
        <AuthFlowDiagram 
          authenticated={userData?.authenticated || false}
          currentStep={userData?.authenticated ? undefined : "init"}
        />

        {/* User Info Section */}
        {userData?.authenticated && (
          <UserInfoSection userData={userData} onRefresh={checkAuthStatus} />
        )}

        {/* API Test Section */}
        {userData?.authenticated && (
          <ApiTestSection />
        )}

        {/* Logs Section */}
        <LogsSection />
      </div>
    </div>
  );
}

