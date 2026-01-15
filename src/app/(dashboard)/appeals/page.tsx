"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAppeals,
  getPostById,
  approveAppeal,
  rejectAppeal,
  getPendingAppealsCount,
  Appeal,
  AppealListResult,
  Post,
} from "@/lib/user-actions";
import { getImageUrl, isVideoUrl } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  User,
  ExternalLink,
  Ban,
} from "lucide-react";

interface AppealWithPost extends Appeal {
  post?: Post | null;
}

export default function AppealsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appeals, setAppeals] = useState<AppealWithPost[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">(
    "pending"
  );
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    appealId: string;
    action: "approve" | "reject";
  }>({ open: false, appealId: "", action: "approve" });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    try {
      const [result, pending] = await Promise.all([
        getAppeals({ page, limit: 20, status: statusFilter }),
        getPendingAppealsCount(),
      ]);

      // Fetch post info for each appeal
      const appealsWithPosts = await Promise.all(
        result.appeals.map(async (appeal) => {
          const post = await getPostById(appeal.postId);
          return { ...appeal, post };
        })
      );

      setAppeals(appealsWithPosts);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setPendingCount(pending);
    } catch (error) {
      console.error("Failed to fetch appeals:", error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchAppeals();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchAppeals]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await approveAppeal(actionDialog.appealId);
      await fetchAppeals();
    } catch (error) {
      console.error("Failed to approve appeal:", error);
    } finally {
      setActionLoading(false);
      setActionDialog({ open: false, appealId: "", action: "approve" });
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await rejectAppeal(actionDialog.appealId);
      await fetchAppeals();
    } catch (error) {
      console.error("Failed to reject appeal:", error);
    } finally {
      setActionLoading(false);
      setActionDialog({ open: false, appealId: "", action: "reject" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-600";
      case "approved":
        return "bg-green-500/20 text-green-600";
      case "rejected":
        return "bg-red-500/20 text-red-500";
      default:
        return "bg-secondary text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appeals</h1>
          <p className="text-muted-foreground mt-1">Review user appeals for blocked posts</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchAppeals}
          className="bg-secondary/50 border-border/50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Appeals</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Appeals</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Page</p>
                <p className="text-2xl font-bold">
                  {page} / {totalPages || 1}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            {(["pending", "all", "approved", "rejected"] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={
                  statusFilter === status
                    ? ""
                    : "bg-secondary/30 border-border/50"
                }
              >
                {status === "pending" && <Clock className="h-4 w-4 mr-1" />}
                {status === "approved" && <CheckCircle className="h-4 w-4 mr-1" />}
                {status === "rejected" && <XCircle className="h-4 w-4 mr-1" />}
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status === "pending" && pendingCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 text-xs">
                    {pendingCount}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Appeals List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : appeals.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-16 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No appeals found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {appeals.map((appeal) => (
            <Card
              key={appeal.$id}
              className={`bg-card/50 border ${
                appeal.status === "pending"
                  ? "border-yellow-500/30"
                  : "border-border/50"
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  {/* Post thumbnail */}
                  {appeal.post && appeal.post.media && appeal.post.media.length > 0 ? (
                    <div
                      className="w-24 h-24 rounded-lg overflow-hidden bg-secondary/30 flex-shrink-0 cursor-pointer"
                      onClick={() => router.push(`/posts/${appeal.postId}`)}
                    >
                      {isVideoUrl(appeal.post.media[0]) ? (
                        <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs">
                          Video
                        </div>
                      ) : (
                        <img
                          src={getImageUrl(appeal.post.media[0], 200, 200)}
                          alt={appeal.post.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ) : (
                    <div
                      className="w-24 h-24 rounded-lg bg-secondary/30 flex items-center justify-center flex-shrink-0 cursor-pointer"
                      onClick={() => router.push(`/posts/${appeal.postId}`)}
                    >
                      <FileText className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}

                  {/* Appeal content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(appeal.status)}`}>
                            {appeal.status}
                          </span>
                          {appeal.post?.isBlacklisted && (
                            <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-500 flex items-center gap-1">
                              <Ban className="h-3 w-3" />
                              Blocked
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium truncate mb-1">
                          {appeal.post?.title || "Unknown Post"}
                        </h3>
                        <div className="text-sm text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Appeal Reason:
                          </span>
                          <p className="mt-1 text-foreground">{appeal.reason}</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {appeal.userId}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(appeal.$createdAt).toLocaleString("en-US")}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/posts/${appeal.postId}`)}
                          className="bg-secondary/50 border-border/50"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Post
                        </Button>
                        {appeal.status === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setActionDialog({
                                  open: true,
                                  appealId: appeal.$id,
                                  action: "approve",
                                })
                              }
                              className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setActionDialog({
                                  open: true,
                                  appealId: appeal.$id,
                                  action: "reject",
                                })
                              }
                              className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-secondary/50 border-border/50"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="bg-secondary/50 border-border/50"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Action Confirmation Dialog */}
      <AlertDialog
        open={actionDialog.open}
        onOpenChange={(open) =>
          setActionDialog({ ...actionDialog, open })
        }
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === "approve"
                ? "Approve this appeal?"
                : "Reject this appeal?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.action === "approve"
                ? "This will unblock the post and make it visible in the public feed again."
                : "This will keep the post blocked. The user will be notified."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-secondary/50 border-border/50"
              disabled={actionLoading}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={
                actionDialog.action === "approve" ? handleApprove : handleReject
              }
              disabled={actionLoading}
              className={
                actionDialog.action === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-destructive hover:bg-destructive/90"
              }
            >
              {actionLoading
                ? "Processing..."
                : actionDialog.action === "approve"
                ? "Approve"
                : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
