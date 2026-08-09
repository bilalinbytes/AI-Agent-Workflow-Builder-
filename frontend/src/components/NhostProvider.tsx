'use client';

import { NhostClient, NhostProvider as Provider } from '@nhost/react';
import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { ReactNode, useMemo, useEffect, useState } from 'react';

const nhost = new NhostClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local',
  region: process.env.NEXT_PUBLIC_NHOST_REGION,
  graphqlUrl: process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL || 'http://localhost:8080/v1/graphql',
  authUrl: process.env.NEXT_PUBLIC_NHOST_AUTH_URL || 'http://localhost:1337/v1',
  storageUrl: process.env.NEXT_PUBLIC_NHOST_STORAGE_URL || 'http://localhost:8000/v1',
  functionsUrl: process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL || 'http://localhost:3000/v1',
});

function CustomApolloProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null | undefined>(null);

  useEffect(() => {
    setAccessToken(nhost.auth.getAccessToken());
    nhost.auth.onAuthStateChanged(() => {
      setAccessToken(nhost.auth.getAccessToken());
    });
    nhost.auth.onTokenChanged(() => {
      setAccessToken(nhost.auth.getAccessToken());
    });
  }, []);

  const apolloClient = useMemo(() => {
    const httpLink = createHttpLink({
      uri: nhost.graphql.httpUrl,
    });

    const authLink = setContext((_, { headers }) => {
      return {
        headers: {
          ...headers,
          authorization: accessToken ? `Bearer ${accessToken}` : '',
          'x-hasura-role': accessToken ? 'owner' : 'public'
        }
      };
    });

    const wsLink = typeof window !== 'undefined'
      ? new GraphQLWsLink(
          createClient({
            url: nhost.graphql.wsUrl,
            connectionParams: () => {
              return {
                headers: {
                  authorization: accessToken ? `Bearer ${accessToken}` : '',
                  'x-hasura-role': accessToken ? 'owner' : 'public'
                }
              };
            }
          })
        )
      : null;

    const splitLink = typeof window !== 'undefined' && wsLink != null
      ? split(
          ({ query }) => {
            const definition = getMainDefinition(query);
            return (
              definition.kind === 'OperationDefinition' &&
              definition.operation === 'subscription'
            );
          },
          wsLink,
          authLink.concat(httpLink)
        )
      : authLink.concat(httpLink);

    return new ApolloClient({
      cache: new InMemoryCache(),
      link: splitLink,
    });
  }, [accessToken]);

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}

export function NhostProvider({ children }: { children: ReactNode }) {
  return (
    <Provider nhost={nhost}>
      <CustomApolloProvider>
        {children}
      </CustomApolloProvider>
    </Provider>
  );
}
