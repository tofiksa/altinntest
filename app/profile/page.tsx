"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Building2, Shield, Users, Code2 } from "lucide-react";

interface AuthorizationDetail {
	type: string;
	resource?: string;
	resource_name?: string;
	authorized_parties?: Array<{
		orgno?: string | { ID: string };
		name?: string;
		unit_type?: string;
		resource?: string;
		reportees?: boolean;
		[key: string]: any;
	}>;
	orgno?: string | { ID: string };
	reportees?: boolean;
	[key: string]: any;
}

interface UserData {
	authenticated: boolean;
	userInfo?: {
		name?: string;
		email?: string;
		sub?: string;
		pid?: string;
	};
	authorizationDetails?: AuthorizationDetail[];
	idTokenClaims?: any;
}

export default function ProfilePage() {
	const router = useRouter();
	const [userData, setUserData] = useState<UserData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchUserData = async () => {
			try {
				const response = await fetch("/api/user", {
					credentials: "include",
				});
				if (response.ok) {
					const data = await response.json();
					setUserData(data);
				} else {
					// Not authenticated, redirect to home
					router.push("/");
				}
			} catch (error) {
				console.error("Error fetching user data:", error);
				router.push("/");
			} finally {
				setLoading(false);
			}
		};
		fetchUserData();
	}, [router]);

	const extractOrgNumber = (orgnoValue: any): string | null => {
		if (!orgnoValue) return null;

		let orgno = orgnoValue;
		if (typeof orgnoValue === "object" && orgnoValue.ID) {
			orgno = orgnoValue.ID;
		}

		if (!orgno) return null;

		if (typeof orgno === "string") {
			if (orgno.includes(":")) {
				const parts = orgno.split(":");
				return parts[parts.length - 1];
			}
			if (/^\d+$/.test(orgno)) {
				return orgno;
			}
		}

		return null;
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">Loading profile...</p>
				</div>
			</div>
		);
	}

	if (!userData?.authenticated) {
		return null; // Will redirect
	}

	const authorizationDetails = userData.authorizationDetails || [];

	return (
		<div className="min-h-screen bg-background p-4 md:p-8">
			<div className="max-w-6xl mx-auto space-y-6">
				{/* Hero Header Section */}
				<Card className="border-2 bg-gradient-to-br from-primary/5 via-background to-background">
					<CardContent className="pt-6">
						<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
							<Button
								variant="ghost"
								size="icon"
								onClick={() => router.push("/")}
								className="shrink-0"
							>
								<ArrowLeft className="h-4 w-4" />
							</Button>
							<div className="flex-1">
								<div className="flex items-center gap-3 mb-2">
									<div className="p-2 bg-primary/10 rounded-lg">
										<Shield className="h-6 w-6 text-primary" />
									</div>
									<h1 className="text-3xl md:text-4xl font-bold">
										Profile & Authorizations
									</h1>
								</div>
								<p className="text-muted-foreground text-base">
									Your authorization details and access privileges from
									ID-porten authentication
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* User Basic Info - Enhanced */}
				{userData.userInfo && (
					<Card className="border-2">
						<CardHeader>
							<div className="flex items-center gap-3">
								<div className="p-2 bg-primary/10 rounded-lg">
									<User className="h-5 w-5 text-primary" />
								</div>
								<div>
									<CardTitle className="text-xl">User Information</CardTitle>
									<CardDescription>
										Your authenticated identity from ID-porten
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 md:grid-cols-2">
								{userData.userInfo.name && (
									<div className="space-y-1">
										<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
											Name
										</div>
										<div className="text-base font-semibold">
											{userData.userInfo.name}
										</div>
									</div>
								)}
								{userData.userInfo.email && (
									<div className="space-y-1">
										<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
											Email
										</div>
										<div className="text-base font-semibold break-all">
											{userData.userInfo.email}
										</div>
									</div>
								)}
								{userData.userInfo.sub && (
									<div className="space-y-1">
										<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
											Subject (sub)
										</div>
										<div className="text-sm font-mono text-muted-foreground break-all">
											{userData.userInfo.sub}
										</div>
									</div>
								)}
								{userData.userInfo.pid && (
									<div className="space-y-1">
										<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
											PID
										</div>
										<div className="text-sm font-mono text-muted-foreground">
											{userData.userInfo.pid}
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Authorization Details */}
				{authorizationDetails.length > 0 ? (
					<div className="space-y-6">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-primary/10 rounded-lg">
								<Shield className="h-6 w-6 text-primary" />
							</div>
							<div>
								<h2 className="text-2xl md:text-3xl font-bold">
									Authorization Details
								</h2>
								<p className="text-muted-foreground">
									Your authorized organizations and access privileges (
									{authorizationDetails.length}{" "}
									{authorizationDetails.length === 1
										? "authorization"
										: "authorizations"}
									)
								</p>
							</div>
						</div>

						{authorizationDetails.map((authDetail, index) => {
							const authKey =
								authDetail.resource ||
								authDetail.resource_name ||
								`auth-${index}`;
							return (
								<Card
									key={authKey}
									className="border-2 hover:shadow-lg transition-shadow"
								>
									<CardHeader>
										<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
											<div className="flex items-start gap-3 flex-1">
												<div className="p-2 bg-primary/10 rounded-lg mt-1">
													<Building2 className="h-5 w-5 text-primary" />
												</div>
												<div className="flex-1 min-w-0">
													<CardTitle className="text-xl mb-1">
														{authDetail.resource_name ||
															authDetail.resource ||
															`Authorization ${index + 1}`}
													</CardTitle>
													{authDetail.resource && (
														<CardDescription className="font-mono text-xs break-all">
															{authDetail.resource}
														</CardDescription>
													)}
												</div>
											</div>
											<Badge variant="secondary" className="shrink-0 w-fit">
												{authDetail.type}
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										{/* Direct orgno (for ansattporten:orgno type) */}
										{authDetail.orgno && (
											<div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
												<div className="flex items-center gap-3">
													<Building2 className="h-5 w-5 text-muted-foreground" />
													<div className="flex-1">
														<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
															Organization Number
														</div>
														<Badge
															variant="outline"
															className="font-mono text-base px-3 py-1"
														>
															{extractOrgNumber(authDetail.orgno) || "N/A"}
														</Badge>
													</div>
												</div>
												{authDetail.reportees !== undefined && (
													<div className="pt-4 border-t space-y-2">
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-2">
																<Users className="h-4 w-4 text-muted-foreground" />
																<span className="font-semibold">
																	Reportees Access
																</span>
															</div>
															<Badge
																variant={
																	authDetail.reportees ? "default" : "secondary"
																}
																className={
																	authDetail.reportees
																		? "bg-green-600 hover:bg-green-700 text-white"
																		: ""
																}
															>
																{authDetail.reportees
																	? "✓ Granted"
																	: "✗ Not Granted"}
															</Badge>
														</div>
														{authDetail.reportees && (
															<p className="text-sm text-muted-foreground pl-6">
																You have access to view reportees for this
																organization
															</p>
														)}
													</div>
												)}
											</div>
										)}

										{/* Authorized Parties */}
										{authDetail.authorized_parties &&
											authDetail.authorized_parties.length > 0 && (
												<div className="space-y-4">
													<div className="flex items-center gap-3">
														<Users className="h-5 w-5 text-primary" />
														<h3 className="font-semibold text-lg">
															Authorized Parties (
															{authDetail.authorized_parties.length})
														</h3>
													</div>
													<div className="grid gap-4 md:grid-cols-2">
														{authDetail.authorized_parties.map(
															(party, partyIndex) => {
																const orgno = extractOrgNumber(party.orgno);
																const partyName =
																	party.name ||
																	authDetail.resource_name ||
																	"Unknown";
																// Check for reportees access in multiple possible locations
																const hasReportees =
																	party.reportees !== undefined
																		? party.reportees
																		: authDetail.reportees !== undefined
																			? authDetail.reportees
																			: party.reportees_access !== undefined
																				? party.reportees_access
																				: undefined;
																const partyKey =
																	orgno ||
																	party.resource ||
																	party.name ||
																	`party-${partyIndex}-${index}`;

																return (
																	<Card
																		key={partyKey}
																		className="bg-gradient-to-br from-primary/5 to-background border-2 border-l-4 border-l-primary hover:shadow-md transition-shadow"
																	>
																		<CardContent className="pt-5 space-y-4">
																			{partyName && (
																				<div>
																					<div className="flex items-center gap-2 mb-2">
																						<User className="h-4 w-4 text-muted-foreground" />
																						<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
																							Organization Name
																						</span>
																					</div>
																					<p className="font-bold text-lg text-foreground">
																						{partyName}
																					</p>
																				</div>
																			)}

																			<div className="grid grid-cols-2 gap-4">
																				{orgno && (
																					<div className="space-y-1">
																						<div className="flex items-center gap-2 mb-1">
																							<Building2 className="h-3 w-3 text-muted-foreground" />
																							<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
																								Org. Number
																							</span>
																						</div>
																						<Badge
																							variant="outline"
																							className="font-mono text-sm px-2 py-1"
																						>
																							{orgno}
																						</Badge>
																					</div>
																				)}

																				{party.unit_type && (
																					<div className="space-y-1">
																						<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
																							Unit Type
																						</span>
																						<Badge
																							variant="secondary"
																							className="text-sm px-2 py-1"
																						>
																							{party.unit_type}
																						</Badge>
																					</div>
																				)}
																			</div>

																			{hasReportees !== undefined && (
																				<div className="pt-3 border-t space-y-2">
																					<div className="flex items-center justify-between">
																						<div className="flex items-center gap-2">
																							<Users className="h-4 w-4 text-muted-foreground" />
																							<span className="font-semibold text-sm">
																								Reportees Access
																							</span>
																						</div>
																						<Badge
																							variant={
																								hasReportees
																									? "default"
																									: "secondary"
																							}
																							className={
																								hasReportees
																									? "bg-green-600 hover:bg-green-700 text-white"
																									: ""
																							}
																						>
																							{hasReportees
																								? "✓ Granted"
																								: "✗ Not Granted"}
																						</Badge>
																					</div>
																					{hasReportees && (
																						<p className="text-xs text-muted-foreground pl-6">
																							You have access to view reportees
																							for this organization
																						</p>
																					)}
																				</div>
																			)}

																			{party.resource && (
																				<div className="text-xs text-muted-foreground font-mono pt-3 border-t break-all">
																					<span className="font-semibold">
																						Resource:
																					</span>{" "}
																					{party.resource}
																				</div>
																			)}
																		</CardContent>
																	</Card>
																);
															},
														)}
													</div>
												</div>
											)}

										{/* No authorized parties but has resource info */}
										{(!authDetail.authorized_parties ||
											authDetail.authorized_parties.length === 0) &&
											authDetail.resource && (
												<div className="text-sm text-muted-foreground">
													<span className="font-semibold">Resource:</span>{" "}
													{authDetail.resource}
												</div>
											)}
									</CardContent>
								</Card>
							);
						})}
					</div>
				) : (
					<Card className="border-2">
						<CardContent className="pt-6 pb-8">
							<div className="text-center space-y-4">
								<div className="p-4 bg-muted/50 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
									<Shield className="h-8 w-8 text-muted-foreground" />
								</div>
								<div>
									<h3 className="font-semibold text-lg mb-2">
										No Authorization Details Available
									</h3>
									<p className="text-sm text-muted-foreground mb-4">
										Authorization details were not returned. This might be
										because:
									</p>
									<ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground max-w-lg mx-auto text-left">
										<li>
											RAR_AUTHORIZATION_DETAILS was not set in the authorization
											request
										</li>
										<li>
											The provider does not support RAR or did not return
											authorization_details
										</li>
										<li>
											The user did not complete the organization selection flow
										</li>
									</ul>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* ID Token Claims Summary - Developer View */}
				{userData.idTokenClaims && (
					<Card className="border-2">
						<CardHeader>
							<div className="flex items-center gap-3">
								<div className="p-2 bg-primary/10 rounded-lg">
									<Code2 className="h-5 w-5 text-primary" />
								</div>
								<div>
									<CardTitle className="text-xl">ID Token Claims</CardTitle>
									<CardDescription>
										Developer view: Raw claims from the ID token (JSON)
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<details className="group">
								<summary className="cursor-pointer text-sm font-medium text-primary hover:underline mb-2 flex items-center gap-2">
									<Code2 className="h-4 w-4" />
									View ID Token Claims (JSON)
								</summary>
								<pre className="mt-4 p-4 bg-muted rounded-md overflow-auto text-xs border max-h-96">
									{JSON.stringify(userData.idTokenClaims, null, 2)}
								</pre>
							</details>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
