export type GlobalRole = "super_admin";
export type SchoolRole = "school_admin" | "distribution_staff";
export type SchoolStatus = "active" | "suspended";
export type StudentStatus = "active" | "inactive";
export type EnrollmentStatus = "active" | "completed" | "withdrawn";
export type ParentLinkStatus = "invited" | "accepted" | "revoked";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export type School = {
  id: string;
  name: string;
  code: string;
  short_name: string | null;
  status: SchoolStatus;
};

export type SchoolMembership = {
  id: string;
  school_id: string;
  user_id: string;
  role: SchoolRole;
  schools: School | null;
};

export type ParentStudentLink = {
  id: string;
  school_id: string;
  student_id: string;
  parent_id: string | null;
  status: ParentLinkStatus;
};

export type AuthContext = {
  userId: string;
  email: string | null;
  profile: Profile | null;
  isSuperAdmin: boolean;
  memberships: SchoolMembership[];
  acceptedParentLinks: ParentStudentLink[];
  pendingParentInvites: ParentStudentLink[];
};

export type WorkspaceKind = "platform" | "school" | "desk" | "parent";
