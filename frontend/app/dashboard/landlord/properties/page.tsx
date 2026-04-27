"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Home,
  Plus,
  Building2,
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
  Clock,
  Search,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEffect } from "react";
import { landlordApi, type LandlordProperty } from "@/lib/landlordApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { VerificationBadge } from "@/components/properties/verification-badge";

import { DashboardHeader } from "@/components/dashboard-header";
import { LandlordSidebar } from "@/components/landlord/LandlordSidebar";

export default function LandlordPropertiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [myProperties, setMyProperties] = useState<LandlordProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const data = await landlordApi.getProperties();
        setMyProperties(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load properties");
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  const filteredProperties = myProperties.filter((property) => {
    const matchesSearch =
      property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || property.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <LandlordSidebar />

      {/* Main Content */}
      <main className="ml-64 min-h-screen pt-20">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                My Properties
              </h1>
              <p className="mt-1 text-muted-foreground">
                Manage all your listed properties
              </p>
            </div>
            <Link href="/dashboard/landlord/properties/new">
              <Button className="border-3 border-foreground bg-primary px-6 py-5 font-bold shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                <Plus className="mr-2 h-5 w-5" />
                Add Property
              </Button>
            </Link>
          </div>

          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-3 border-foreground bg-background pl-12 py-5 font-medium shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]"
              />
            </div>
            <div className="flex gap-2">
              {["all", "active", "pending", "inactive"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`border-3 border-foreground px-4 py-2 font-bold capitalize transition-all ${
                    statusFilter === status
                      ? "bg-foreground text-background"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

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

          {/* Properties Grid */}
          <div className="grid gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-3 border-foreground p-0 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
                  <div className="flex h-48 animate-pulse bg-muted/50" />
                </Card>
              ))
            ) : filteredProperties.length === 0 ? (
              <Card className="border-3 border-foreground p-12 text-center shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
                <Building2 className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-bold">No Properties Found</h3>
                <p className="mt-2 text-muted-foreground">
                  {searchQuery
                    ? "Try a different search term"
                    : "Start by adding your first property"}
                </p>
              </Card>
            ) : (
              filteredProperties.map((property) => {
                let statusBadgeClass = "bg-muted"
                let statusLabel = "Inactive"

                switch (property.status) {
                  case "active":
                    statusBadgeClass = "bg-secondary"
                    statusLabel = "Active"
                    break
                  case "pending":
                    statusBadgeClass = "bg-accent"
                    statusLabel = "Pending"
                    break
                  default:
                    break
                }

                return (
                  <Card
                    key={property.id}
                    className="border-3 border-foreground p-0 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]"
                  >
                    <div className="flex">
                      <div className="relative h-48 w-72 shrink-0 border-r-3 border-foreground bg-muted">
                        <div className="flex h-full items-center justify-center">
                          <Building2 className="h-16 w-16 text-muted-foreground" />
                        </div>
                        <div
                          className={`absolute left-3 top-3 border-2 border-foreground px-3 py-1 text-sm font-bold ${statusBadgeClass}`}
                        >
                          {statusLabel}
                        </div>
                      </div>

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
                        <VerificationBadge status={property.verificationStatus as any} />
                      </div>

                      {property.verificationStatus === "PENDING" && (
                        <div className="mb-4 border-3 border-foreground bg-accent/10 p-3 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                            <span>Verification Progress</span>
                            <span>65%</span>
                          </div>
                          <Progress value={65} className="h-3 border-2 border-foreground bg-background rounded-none" />
                          <p className="mt-2 text-xs text-muted-foreground">
                            Our agents are currently reviewing your documents and property photos.
                          </p>
                        </div>
                      )}

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

                        {property.tenant ? (
                          <div className="flex items-center gap-3 border-3 border-foreground bg-secondary/30 px-4 py-2">
                            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-secondary font-bold">
                              {property.tenant.avatar}
                            </div>
                            <div>
                              <p className="text-sm font-bold">
                                {property.tenant.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Current Tenant
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 border-3 border-dashed border-foreground bg-accent/30 px-4 py-2">
                            <Clock className="h-5 w-5" />
                            <span className="font-medium">Vacant</span>
                          </div>
                        )}
                      </div>
                    </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
