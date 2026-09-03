import { Link } from "wouter";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tayaLogoUrl, TAYA_PRODUCT_NAME } from "@/lib/tayaBrand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mb-8 flex flex-col items-center">
        <img src={tayaLogoUrl} alt={TAYA_PRODUCT_NAME} className="mb-4 h-12 w-auto" />
        <div className="h-1 w-16 rounded-full bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-400" />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <AlertCircle className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-950">Page not found</h1>
            <p className="text-sm text-slate-500">Error 404</p>
          </div>
        </div>
        <p className="mb-6 text-sm leading-6 text-slate-600">
          The page you're looking for doesn't exist or may have been moved. If you
          reached this page from a bookmark, the link may be outdated.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/app">
            <Button className="w-full sm:w-auto">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
