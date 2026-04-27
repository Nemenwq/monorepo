"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Home,
  Plus,
  Building2,
  Users,
  MessageSquare,
  Settings,
  MapPin,
  Bed,
  Bath,
  Square,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Menu,
  X,
  CheckCircle2,
  DollarSign,
  Loader2,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { useEffect } from "react";
import { landlordApi, type LandlordProperty, type LandlordStat } from "@/lib/landlordApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardHeader } from "@/components/dashboard-header";

// Mock data for landlord's properties

import { LandlordSidebar } from "@/components/landlord/LandlordSidebar";

export default function LandlordDashboard() {
  const [activeTab, setActiveTab ] = useState<"properties" | "applications">(
    "properties",
  );
  const [stats, setStats] = useState<LandlordStat[]>([]);
  const [myProperties, setMyProperties] = useState<LandlordProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const data = await landlordApi.getDashboardData();
        setStats(data.stats);
        setMyProperties(data.properties);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Building2": return Building2;
      case "CheckCircle": return CheckCircle2;
      case "Eye": return Eye;
      case "DollarSign": return DollarSign;
      case "Users": return Users;
      case "MessageSquare": return MessageSquare;
      default: return Building2;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <LandlordSidebar />

      {/* Main Content */}
      <main className="min-h-screen pt-20 lg:ml-64">
        <div className="p-4 md:p-6 lg:p-8">
          {/* Error State */}
          {error && (
            <div className="mb-8 border-3 border-destructive bg-destructive/10 p-6 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-6 w-6" />
                <p className="font-bold">{error}</p>
              </div>
              <Button 
                onClick={() => window.location.reload()}
                className="mt-4 border-2 border-destructive bg-transparent font-bold text-destructive hover:bg-destructive hover:text-white"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl lg:text-4xl">
                Welcome back, Chief!
              </h1>
              <p className="mt-2 text-sm text-muted-foreground md:text-base lg:text-lg">
                Here&apos;s what&apos;s happening with your properties
              </p>
            </div>
            <Link href="/dashboard/landlord/properties/new">
              <Button className="w-full border-3 border-foreground bg-primary px-4 py-4 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] md:w-auto md:px-6 md:py-6 md:text-lg">
                <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                Add Property
              </Button>
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:mb-8 md:grid-cols-4 md:gap-6">
            {loading 
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="border-3 border-foreground p-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6">
                    <div className="flex items-center gap-2 md:gap-4">
                      <Skeleton className="h-10 w-10 md:h-14 md:w-14 bg-muted border-3 border-foreground" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-20 bg-muted" />
                        <Skeleton className="h-8 w-24 bg-muted" />
                      </div>
                    </div>
                  </Card>
                ))
              : stats.map((stat) => {
                  const Icon = getIcon(stat.icon);
                  return (
                    <Card
                      key={stat.label}
                      className="border-3 border-foreground p-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] md:p-6"
                    >
                      <div className="flex items-center gap-2 md:gap-4">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center border-3 border-foreground md:h-14 md:w-14 ${stat.color}`}
                        >
                          <Icon className="h-5 w-5 md:h-7 md:w-7" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-muted-foreground md:text-sm">
                            {stat.label}
                          </p>
                          <p className="truncate text-xl font-bold text-foreground md:text-3xl">
                            {stat.value}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
          </div>

          {/* Tabs */}
          <div className="mb-6 flex flex-wrap gap-2 md:gap-4">
            <button
              onClick={() => setActiveTab("properties")}
              className={`border-3 border-foreground px-3 py-2 text-sm font-bold transition-all md:px-6 md:py-3 md:text-base ${
                activeTab === "properties"
                  ? "bg-foreground text-background shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
                  : "bg-card hover:bg-muted"
              }`}
            >
              Properties
            </button>
            <button
              onClick={() => setActiveTab("applications")}
              className={`border-3 border-foreground px-3 py-2 text-sm font-bold transition-all md:px-6 md:py-3 md:text-base ${
                activeTab === "applications"
                  ? "bg-foreground text-background shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
                  : "bg-card hover:bg-muted"
              }`}
            >
              Applications
            </button>
          </div>

          {/* Properties Tab */}
          {activeTab === "properties" && (
            <div className="grid gap-6">
              {loading 
                ? Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} className="border-3 border-foreground p-0 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
                      <div className="flex h-48 animate-pulse bg-muted/50" />
                    </Card>
                  ))
                : myProperties.length === 0 ? (
                  <Card className="border-3 border-foreground p-12 text-center shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
                    <Building2 className="mx-auto h-16 w-16 text-muted-foreground" />
                    <h3 className="mt-4 text-xl font-bold">No Properties Found</h3>
                    <p className="mt-2 text-muted-foreground">Start by adding your first property</p>
                  </Card>
                ) : myProperties.map((property) => {
                let statusBadgeClassName = "bg-muted"
                if (property.status === "active") {
                  statusBadgeClassName = "bg-secondary"
                } else if (property.status === "pending") {
                  statusBadgeClassName = "bg-accent"
                }

                let statusLabel = "Inactive"
                if (property.status === "active") {
                  statusLabel = "Active"
                } else if (property.status === "pending") {
                  statusLabel = "Pending"
                }

                return (
                  <Card
                    key={property.id}
                    className="border-3 border-foreground p-0 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
                  >
                    <div className="flex">
                    {/* Property Image */}
                    <div className="relative h-48 w-72 shrink-0 border-r-3 border-foreground bg-muted">
                      <div className="flex h-full items-center justify-center">
                        <Building2 className="h-16 w-16 text-muted-foreground" />
                      </div>
                      <div
                        className={`absolute left-3 top-3 border-2 border-foreground px-3 py-1 text-sm font-bold ${statusBadgeClassName}`}
                      >
                        {statusLabel}
                      </div>
                    </div>

                    {/* Property Details */}
                    <div className="flex flex-1 flex-col p-6">
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-foreground">
                            {property.title}
                          </h3>
                          <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            {property.location}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="border-3 border-foreground bg-transparent"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="border-3 border-foreground">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" /> Edit Property
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" /> View Listing
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="mb-4 flex gap-6">
                        <span className="flex items-center gap-1 text-sm font-medium">
                          <Bed className="h-4 w-4" /> {property.beds} Beds
                        </span>
                        <span className="flex items-center gap-1 text-sm font-medium">
                          <Bath className="h-4 w-4" /> {property.baths} Baths
                        </span>
                        <span className="flex items-center gap-1 text-sm font-medium">
                          <Square className="h-4 w-4" /> {property.sqm} sqm
                        </span>
                      </div>

                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <p className="text-2xl font-bold text-primary">
                            ₦{property.price.toLocaleString()}
                            <span className="text-sm font-normal text-muted-foreground">
                              /year
                            </span>
                          </p>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" /> {property.views} views
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" />{" "}
                              {property.inquiries} inquiries
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                )
              })}
            </div>
          )}

          {activeTab === "applications" && (
            <Card className="border-3 border-foreground p-12 text-center shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
              <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-bold">No Applications Yet</h3>
              <p className="mt-2 text-muted-foreground">Applications for your properties will appear here</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
