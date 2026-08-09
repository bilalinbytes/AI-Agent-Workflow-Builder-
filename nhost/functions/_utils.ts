import { GraphQLClient } from 'graphql-request';

export const getGraphqlClient = () => {
  const endpoint = process.env.NHOST_GRAPHQL_URL || 'http://localhost:8080/v1/graphql';
  const adminSecret = process.env.NHOST_ADMIN_SECRET || 'nhost-admin-secret';
  
  return new GraphQLClient(endpoint, {
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
  });
};

export const executeGraphql = async (query: string, variables: any = {}) => {
  const client = getGraphqlClient();
  return client.request(query, variables);
};
