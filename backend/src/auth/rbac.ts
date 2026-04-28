export const Roles = {
  TENANT: "tenant",
  LANDLORD: "landlord",
  ADMIN: "admin",
  OPERATOR: "operator",
};

export const Permissions: Record<string, string[]> = {
  CREATE_LISTING: ["landlord"],
  DELETE_LISTING: ["admin"],
};

export function requirePermission(permission: string) {
  return (req: any, res: any, next: any) => {
    const user = req.user;

    if (!user || !Permissions[permission] || !Permissions[permission].includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}

export function enforceOwnership(resource: any, req: any, res: any, next: any) {
  if (resource.ownerId !== req.user.id) {
    return res.status(403).send("Not owner");
  }
  next();
}
