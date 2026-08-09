const { NhostClient } = require('@nhost/nhost-js');

const nhost = new NhostClient({
  subdomain: 'local',
  region: 'local',
  graphqlUrl: 'http://localhost:8080/v1/graphql',
  authUrl: 'http://localhost:1337/v1'
});

async function test() {
  const { session, error } = await nhost.auth.signIn({
    email: 'mohammedbilal96654@gmail.com',
    password: 'password' // I don't know the password
  });

  if (error) {
    console.error('Login Error:', error);
  } else {
    console.log('JWT Allowed Roles:', session?.user?.allowedRoles);
    console.log('JWT Default Role:', session?.user?.defaultRole);
  }
}

test();
