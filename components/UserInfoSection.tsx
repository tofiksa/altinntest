"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UserInfoSectionProps {
  userData: any;
  onRefresh: () => void;
}

export default function UserInfoSection({ userData, onRefresh }: UserInfoSectionProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchUserInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/user");
      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
        setShowDetails(true);
      }
    } catch (error) {
      console.error("Error fetching user information:", error);
    } finally {
      setLoading(false);
    }
  };

  const extractOrganizationNumbers = (authorizationDetails: any) => {
    const orgNumbers: any[] = [];
    
    if (!authorizationDetails || !Array.isArray(authorizationDetails)) {
      return orgNumbers;
    }
    
    function extractOrgNumber(orgnoValue: any) {
      if (!orgnoValue) return null;
      
      let orgno = orgnoValue;
      if (typeof orgnoValue === 'object' && orgnoValue.ID) {
        orgno = orgnoValue.ID;
      }
      
      if (!orgno) return null;
      
      if (typeof orgno === 'string') {
        if (orgno.includes(':')) {
          const parts = orgno.split(':');
          return parts[parts.length - 1];
        }
        if (/^\d+$/.test(orgno)) {
          return orgno;
        }
      }
      
      return null;
    }
    
    authorizationDetails.forEach((authDetail: any) => {
      if (authDetail.orgno) {
        const orgno = extractOrgNumber(authDetail.orgno);
        if (orgno) {
          orgNumbers.push({
            orgno: orgno,
            type: authDetail.type,
            fullId: typeof authDetail.orgno === 'object' ? authDetail.orgno.ID : authDetail.orgno
          });
        }
      }
      
      if (authDetail.authorized_parties && Array.isArray(authDetail.authorized_parties)) {
        authDetail.authorized_parties.forEach((party: any) => {
          if (party.orgno) {
            const orgno = extractOrgNumber(party.orgno);
            if (orgno) {
              orgNumbers.push({
                orgno: orgno,
                type: authDetail.type,
                resource: authDetail.resource || party.resource,
                resourceName: authDetail.resource_name || party.name,
                unitType: party.unit_type,
                fullId: typeof party.orgno === 'object' ? party.orgno.ID : party.orgno
              });
            }
          }
        });
      }
    });
    
    return orgNumbers;
  };

  const data = userInfo || userData;
  const orgNumbers = extractOrganizationNumbers(data?.authorizationDetails);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Information</CardTitle>
            <CardDescription>Your authentication details and organization information</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUserInfo}
            disabled={loading}
          >
            {loading ? "Loading..." : "View Details"}
          </Button>
        </div>
      </CardHeader>
      {showDetails && userInfo && (
        <CardContent className="space-y-4">
          {userInfo.userInfo && (
            <div className="space-y-2">
              <h3 className="font-semibold">Basic Information</h3>
              {userInfo.userInfo.sub && (
                <p><strong>Subject:</strong> {userInfo.userInfo.sub}</p>
              )}
              {userInfo.userInfo.name && (
                <p><strong>Name:</strong> {userInfo.userInfo.name}</p>
              )}
              {userInfo.userInfo.email && (
                <p><strong>Email:</strong> {userInfo.userInfo.email}</p>
              )}
              {userInfo.userInfo.pid && (
                <p><strong>PID:</strong> {userInfo.userInfo.pid}</p>
              )}
            </div>
          )}

          {orgNumbers.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Organization Numbers</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(orgNumbers.map((o: any) => o.orgno))).map((orgno: any) => (
                  <Badge key={orgno} variant="default" className="text-sm">
                    {orgno}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">
              View Full Details (JSON)
            </summary>
            <pre className="mt-2 p-4 bg-muted rounded-md overflow-auto text-xs">
              {JSON.stringify(userInfo, null, 2)}
            </pre>
          </details>
        </CardContent>
      )}
    </Card>
  );
}

