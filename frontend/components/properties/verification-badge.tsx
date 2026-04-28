import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

interface VerificationBadgeProps {
  status: VerificationStatus
  className?: string
  showLabel?: boolean
}

export function VerificationBadge({
  status,
  className,
  showLabel = true,
}: VerificationBadgeProps) {
  const config = {
    PENDING: {
      label: 'Pending Verification',
      variant: 'secondary' as const,
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
    },
    VERIFIED: {
      label: 'Verified Property',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    },
    REJECTED: {
      label: 'Verification Rejected',
      variant: 'destructive' as const,
      icon: AlertCircle,
      className: '', // Uses default destructive styles
    },
  }

  const { label, variant, icon: Icon, className: statusClasses } = config[status]

  return (
    <Badge
      variant={variant}
      className={cn('flex items-center gap-1.5 px-2.5 py-1 font-semibold', statusClasses, className)}
    >
      <Icon className="h-3.5 w-3.5" />
      {showLabel && <span>{label}</span>}
    </Badge>
  )
}
