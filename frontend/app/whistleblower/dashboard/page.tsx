"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Plus,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  Star,
  DollarSign,
  Home,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import {
  getWhistleblowerDashboardData,
  type WhistleblowerDashboardData,
} from "@/lib/api/whistleblowerDashboard";
import { whistleblowerData as mockData } from "@/lib/mockData";

export default function WhistleblowerDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WhistleblowerDashboardData | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const result = await getWhistleblowerDashboardData();
        setData(result);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch whistleblower data:", err);
        setError("Failed to connect to live data. Please ensure the backend is running.");
        // Fallback to mock data in development if needed, but the requirement is "live"
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="font-mono text-lg font-bold">Loading your dashboard...</p>
      </div>
    );
  }

  // Use live data if available, otherwise show error
  const dashboardData = data?.stats;
  const listings = data?.listings || [];
  const earnings = data?.earnings || [];

  if (error && !data) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <div className="max-w-md w-full border-3 border-destructive bg-destructive/10 p-8 text-center shadow-[8px_8px_0px_0px_rgba(26,26,26,1)]">
          <AlertCircle className="mx-auto h-16 w-16 text-destructive mb-4" />
          <h1 className="font-mono text-2xl font-black mb-2 text-destructive">Connection Error</h1>
          <p className="text-destructive/80 mb-6">{error}</p>
          <Button 
            className="w-full border-3 border-foreground bg-primary font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
            onClick={() => window.location.reload()}
          >
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center border-3 border-foreground bg-primary shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] lg:hidden"
      >
        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-foreground/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-64 border-r-3 border-foreground bg-card pt-20 transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-full flex-col px-4 py-6">
          <div className="mb-8 border-3 border-foreground bg-secondary p-4 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
            <p className="text-sm font-medium text-foreground">Whistleblower</p>
            <p className="text-lg font-bold text-foreground">
              {mockData.name}
            </p>
            <div className="mt-2 flex items-center gap-1">
              <Star className="h-4 w-4 fill-accent text-accent" />
              <span className="text-sm font-bold">
                {dashboardData.rating}
              </span>
              <span className="text-xs text-muted-foreground">
                ({dashboardData.reviews} reviews)
              </span>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            <Link
              href="/whistleblower/dashboard"
              className="flex items-center gap-3 border-3 border-foreground bg-primary p-3 font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-5 w-5" />
              Dashboard
            </Link>
            <Link
              href="/whistleblower/report"
              className="flex items-center gap-3 border-3 border-foreground bg-card p-3 font-bold transition-all hover:bg-muted hover:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
              onClick={() => setSidebarOpen(false)}
            >
              <Plus className="h-5 w-5" />
              Report Apartment
            </Link>
            <Link
              href="/whistleblower/earnings"
              className="flex items-center gap-3 border-3 border-foreground bg-card p-3 font-bold transition-all hover:bg-muted hover:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
              onClick={() => setSidebarOpen(false)}
            >
              <DollarSign className="h-5 w-5" />
              Earnings
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-h-screen pt-20 lg:ml-64">
        <div className="p-4 md:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground md:text-3xl lg:text-4xl">
              Whistleblower Dashboard
            </h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Report vacant apartments and earn ₦10-20k per successful rental
            </p>
          </div>

          {/* Stats Grid */}
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
            <Card className="border-3 border-foreground p-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border-3 border-foreground bg-primary md:h-14 md:w-14">
                  <DollarSign className="h-5 w-5 md:h-7 md:w-7" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground md:text-sm">
                    Total Earnings
                  </p>
                  <p className="truncate text-xl font-bold text-foreground md:text-3xl">
                    ₦{dashboardData.totalEarnings.toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-3 border-foreground p-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border-3 border-foreground bg-secondary md:h-14 md:w-14">
                  <CheckCircle className="h-5 w-5 md:h-7 md:w-7" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground md:text-sm">
                    Reports This Month
                  </p>
                  <p className="truncate text-xl font-bold text-foreground md:text-3xl">
                    {dashboardData.reportsThisMonth}/{dashboardData.maxReportsPerMonth}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-3 border-foreground p-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border-3 border-foreground bg-accent md:h-14 md:w-14">
                  <Home className="h-5 w-5 md:h-7 md:w-7" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground md:text-sm">
                    Active Listings
                  </p>
                  <p className="truncate text-xl font-bold text-foreground md:text-3xl">
                    {dashboardData.activeListings}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-3 border-foreground p-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border-3 border-foreground bg-muted md:h-14 md:w-14">
                  <TrendingUp className="h-5 w-5 md:h-7 md:w-7" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground md:text-sm">
                    Rating
                  </p>
                  <p className="truncate text-xl font-bold text-foreground md:text-3xl">
                    {dashboardData.rating}⭐
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Report Limit Warning */}
          {dashboardData.reportsThisMonth >= dashboardData.maxReportsPerMonth && (
            <div className="mb-8 border-3 border-destructive bg-red-100 p-4 rounded-sm">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-destructive mb-1">
                    Monthly Limit Reached
                  </p>
                  <p className="text-xs text-destructive/80">
                    You've reached your {dashboardData.maxReportsPerMonth} apartment limit for this month. Come
                    back next month to report more.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Listings */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-lg font-bold md:text-xl">
                Your Active Listings
              </h2>
              {dashboardData.reportsThisMonth < dashboardData.maxReportsPerMonth && (
                <Link href="/whistleblower/report">
                  <Button className="border-3 border-foreground bg-primary font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                    <Plus className="mr-2 h-4 w-4" />
                    Report Apartment
                  </Button>
                </Link>
              )}
            </div>

            <div className="space-y-4">
              {listings.length === 0 ? (
                <div className="border-3 border-foreground border-dashed p-12 text-center bg-muted/30">
                  <Home className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="font-mono text-lg font-bold">No active listings</p>
                  <p className="text-muted-foreground mt-2">Report your first apartment to start earning!</p>
                </div>
              ) : (
                listings.map((listing) => (
                  <Card
                    key={listing.id}
                    className="border-3 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-foreground md:text-xl">
                          {listing.address}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          ₦{listing.price.toLocaleString()}/year • {listing.beds}{" "}
                          bed(s) • {listing.baths} bath(s)
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Posted: {listing.postedDate}
                        </p>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-1 border-l-2 border-foreground pl-4">
                          <p className="text-xs text-muted-foreground">Views</p>
                          <p className="text-lg font-bold">{listing.views}</p>
                        </div>

                        <div className="flex flex-col items-center gap-1 border-l-2 border-foreground pl-4">
                          <p className="text-xs text-muted-foreground">Status</p>
                          <div
                            className={`text-sm font-bold ${listing.status === "rented" ? "text-secondary" : "text-primary"}`}
                          >
                            {listing.status === "rented" ? "✓ Rented" : listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                          </div>
                        </div>

                        {listing.status === "rented" && (
                          <div className="flex flex-col items-center gap-1 border-l-2 border-foreground pl-4">
                            <p className="text-xs text-muted-foreground">
                              Earned
                            </p>
                            <p className="text-lg font-bold text-primary">
                              ₦{listing.earnings.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              ))}
            </div>
          </div>

          {/* Recent Earnings */}
          <div>
            <h2 className="font-mono text-lg font-bold mb-4 md:text-xl">
              Recent Earnings
            </h2>
            <div className="space-y-3">
              {earnings.length === 0 ? (
                <div className="border-3 border-foreground border-dashed p-8 text-center bg-muted/30">
                  <p className="text-muted-foreground italic">No recent earnings records found.</p>
                </div>
              ) : (
                earnings.map((earning, idx) => (
                  <Card
                    key={`${earning.listing}-${earning.date}-${idx}`}
                    className="border-3 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-bold">{earning.listing}</p>
                        <p className="text-xs text-muted-foreground">
                          {earning.date}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-lg font-bold text-primary">
                          +₦{earning.amount.toLocaleString()}
                        </p>
                        <div
                          className={`flex items-center gap-1 px-3 py-1 border-2 border-foreground text-xs font-bold ${earning.status === "completed" ? "bg-secondary" : "bg-accent"}`}
                        >
                          {earning.status === "completed" ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                          {earning.status === "completed"
                            ? "Completed"
                            : "Pending"}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
