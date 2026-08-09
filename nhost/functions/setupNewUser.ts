import { Request, Response } from 'express';
import { executeGraphql } from './_utils';

const CREATE_ORG_AND_MEMBER = `
  mutation SetupNewUser($userId: uuid!, $orgName: String!) {
    org: insert_organizations_one(object: { name: $orgName }) {
      id
    }
  }
`;

const ADD_MEMBER = `
  mutation AddOrgMember($userId: uuid!, $orgId: uuid!) {
    insert_org_members_one(object: {
      user_id: $userId,
      organization_id: $orgId,
      role: "owner"
    }) {
      id
    }
  }
`;

export default async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, orgName } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const name = orgName || 'My Organization';

    // Step 1: Create the organization
    const orgResult: any = await executeGraphql(CREATE_ORG_AND_MEMBER, {
      userId,
      orgName: name,
    });

    const orgId = orgResult?.org?.id;
    if (!orgId) {
      return res.status(500).json({ error: 'Failed to create organization' });
    }

    // Step 2: Add user as owner
    await executeGraphql(ADD_MEMBER, { userId, orgId });

    return res.status(200).json({ success: true, orgId });
  } catch (error: any) {
    console.error('setupNewUser error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
