import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface LogoutContextValue {
  /** Opens the logout confirmation dialog. */
  requestLogout: () => void;
}

const LogoutContext = createContext<LogoutContextValue | undefined>(undefined);

interface LogoutProviderProps {
  children: ReactNode;
}

export function LogoutProvider({ children }: LogoutProviderProps) {
  const { signOut } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const requestLogout = useCallback(() => {
    setIsOpen(true);
  }, []);

  const performLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      const result: any = await signOut();
      if (result?.error) {
        throw result.error;
      }
      queryClient.clear();
      setIsOpen(false);
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Failed to log out",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  }, [signOut, queryClient, setLocation, toast]);

  return (
    <LogoutContext.Provider value={{ requestLogout }}>
      {children}
      <AlertDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!isLoggingOut) {
            setIsOpen(open);
          }
        }}
      >
        <AlertDialogContent data-testid="dialog-logout-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of Granted?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign in again to access your projects, drafts, and settings.
              Any unsaved changes may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                performLogout();
              }}
              disabled={isLoggingOut}
              data-testid="button-logout-confirm"
              className={cn(
                buttonVariants({ variant: "destructive" }),
                "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              {isLoggingOut ? (
                <span className="flex items-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Logging out...
                </span>
              ) : (
                <span className="flex items-center">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LogoutContext.Provider>
  );
}

export function useLogout(): () => void {
  const context = useContext(LogoutContext);
  if (!context) {
    throw new Error("useLogout must be used within a LogoutProvider");
  }
  return context.requestLogout;
}
