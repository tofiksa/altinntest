"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ApiTestSection() {
  const [instanceId, setInstanceId] = useState("");
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testApiCall = async (endpoint: string) => {
    setLoading(true);
    setApiResponse(null);
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      setApiResponse(data);
      // Refresh logs after a short delay
      setTimeout(() => {
        // Trigger logs refresh if LogsSection is listening
        window.dispatchEvent(new Event("refreshLogs"));
      }, 500);
    } catch (error: any) {
      setApiResponse({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Altinn API Calls</CardTitle>
        <CardDescription>Test various Altinn Platform and App APIs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform API */}
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg">Platform API</h3>
            <p className="text-sm text-muted-foreground">
              Platform-wide APIs for Storage, Profile, etc.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => testApiCall("/api/platform/profile")}
              disabled={loading}
              variant="outline"
            >
              Get Profile
            </Button>
            <Button
              onClick={() => testApiCall("/api/platform/storage/instances")}
              disabled={loading}
              variant="outline"
            >
              Get All Instances
            </Button>
          </div>
        </div>

        {/* Storage API */}
        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="font-semibold text-lg">Storage API</h3>
            <p className="text-sm text-muted-foreground">
              Access instances across all applications
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                testApiCall(
                  `/api/platform/storage/instances/${encodeURIComponent(instanceId)}`
                )
              }
              disabled={loading || !instanceId}
              variant="outline"
            >
              Get Instance (by ID)
            </Button>
            <Button
              onClick={() =>
                testApiCall(
                  `/api/platform/storage/instances/${encodeURIComponent(instanceId)}/dataelements`
                )
              }
              disabled={loading || !instanceId}
              variant="outline"
            >
              Get Data Elements
            </Button>
            <Button
              onClick={() =>
                testApiCall(
                  `/api/platform/storage/instances/${encodeURIComponent(instanceId)}/events`
                )
              }
              disabled={loading || !instanceId}
              variant="outline"
            >
              Get Instance Events
            </Button>
          </div>
          <Input
            placeholder="Instance ID"
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* App API */}
        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="font-semibold text-lg">App API</h3>
            <p className="text-sm text-muted-foreground">
              App-specific APIs (requires ALTINN_ORG and ALTINN_APP_NAME)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => testApiCall("/api/app/metadata")}
              disabled={loading}
              variant="outline"
            >
              Get App Metadata
            </Button>
            <Button
              onClick={() => testApiCall("/api/app/instances")}
              disabled={loading}
              variant="outline"
            >
              Get App Instances
            </Button>
          </div>
        </div>

        {/* API Response */}
        {apiResponse && (
          <div className="border-t pt-4 space-y-2">
            <h3 className="font-semibold">API Response</h3>
            <pre className="p-4 bg-muted rounded-md overflow-auto text-xs max-h-96">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

