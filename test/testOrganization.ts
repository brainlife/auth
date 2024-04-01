const axios = require('axios');
const jwt = require('jsonwebtoken');

const host = 'http://localhost:8080/api/auth';

const users = [
    { username: 'user1', password: 'pass1', email: 'user1@example.com' },
    { username: 'user2', password: 'pass2', email: 'user2@example.com' }
];

const signupUser = async (userData) => {
    try {
        const response = await axios.post(`${host}/signup`, userData);
        return response.data;
    } catch (error) {
        console.error('Signup error:', error.response.data);
        throw error;
    }
};

const loginUser = async (userData) => {
    try {
        const response = await axios.post(`${host}/local/auth`, {
            username: userData.username,
            password: userData.password
        });

        const decodedToken = jwt.decode(response.data.jwt);
        console.log('Decoded JWT:', decodedToken);

        return response.data;

    } catch (error) {
        console.error('Login error:', error.response.data);
        throw error;
    }
};

const handleSignupAndLogin = async () => {
    const usersLoggedIN = [];
    for (const user of users) {
        try {
            const signupResponse = await signupUser(user);
            const loginResponse = await loginUser(user);
            console.log(`User ${user.username} logged in with JWT: ${loginResponse.jwt}, id: ${loginResponse._id}`);

            usersLoggedIN.push(loginResponse);


        } catch (error) {
            console.error(`Error processing user ${user.username}`);
        }
    }
    return usersLoggedIN;
};

const signupUrl = `${host}/signup`;

const user1 = {
    email: 'user1@example.com',
    username: 'user1',
    password: 'password123TEST'
};

const user2 = {
    email: 'user2@example.com',
    username: 'user2',
    password: 'password456TEST',
};

const signUpAndLogin = async (user) => {
    try {
        await axios.post(signupUrl, user);

        const response = await axios.post(`${host}/local/auth`, {
            email: user.email,
            password: user.password
        });

        console.log(`User ${user.email} signed up and logged in.`);
        return response.data;
    } catch (error) {
        console.error(`Error signing up or logging in user ${user.email}:`, error);
    }
};


const organizationCreateURL = `${host}/organization/create`;

const createOrganization = async (jwt, organizationData) => {
    try {
        const response = await axios.post(organizationCreateURL, organizationData, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        console.log('Organization created:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error creating organization:', error);
    }
};

const organizationData = {
    name: 'New Organization',
    owner: '',
    roles: [
        {
            role: 'admin',
            members: []
        },
        {
            role: 'member',
            members: []
        }
    ]
};



const updateOrganization = async (jwt, organizationId, updateData) => {
    try {
        const response = await axios.put(`${host}/organization/${organizationId}`, updateData, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        console.log('Organization updated:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error updating organization:', error);
    }
}

const getOrganization = async (jwt, organizationId) => {
    try {
        const response = await axios.get(`${host}/organization/${organizationId}`, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        console.log('Organization details:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching organization:', error);
    }
};


const deleteOrganization = async (jwt, organizationId) => {
    try {
        const response = await axios.delete(`${host}/organization/${organizationId}`, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });

        console.log('Organization deleted:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error deleting organization:', error);
    }
};

const inviteUserToOrganization = async (jwt, organizationId, inviteeId, role) => {
    try {
        const response = await axios.post(`${host}/organization/${organizationId}/invite`, {
            role,
            invitee: inviteeId
        }, {
            headers: {
                Authorization: `Bearer ${jwt}`
            }
        });
        return response.data;
    }
    catch (error) {
        console.error('Error inviting user to organization:', error);
    }

};


const deleteUsers = async (users) => {
    // for (const user of users) {
    //     try {
    //         await axios.delete(`${host}/user/${user._id}`);
    //         console.log(`User ${user.username} deleted`);
    //     } catch (error) {
    //         console.error(`Error deleting user ${user.username}:`, error);
    //     }
    // }
};




const executeWorkflow = async () => {
    const users = await handleSignupAndLogin();
    const user1_loggedIn = users[0];
    const user2_loggedIN = users[1];

    let organizationData = {
        name: 'New Organization',
        roles: [
            {
                role: 'admin',
                members: [user1_loggedIn._id]
            },
            {
                role: 'member',
                members: [user2_loggedIN._id]
            }
        ],
        owner: user1_loggedIn._id
    }

    organizationData.roles[0].members.push(user1_loggedIn._id);

    const organization = await createOrganization(user1_loggedIn.jwt, organizationData);

    console.log('Organization created:', organization);


    const updateData = {
        name: 'Updated Organization Name'
    };
    await updateOrganization(user1_loggedIn.jwt, organization._id, updateData);


    const updatedOrg = await getOrganization(user1_loggedIn.jwt, organization._id);
    if (updatedOrg.name === updateData.name) {
        console.log('Organization updated successfully');
    }

    // await deleteOrganization(user1_loggedIn.jwt, organization._id);

    // const deletedOrg = await getOrganization(user1_loggedIn.jwt, organization._id);
    // if (deletedOrg.removed === true) {
    //     console.log('Organization deleted successfully');
    // }

    const organizationsData = [
        {
            name: 'Organization One',
            owner: user1_loggedIn._id,
            roles: [
                {
                    role: 'admin',
                    members: [user1_loggedIn._id]
                }
            ]
        },
        {
            name: 'Organization Two',
            owner: user1_loggedIn._id,
            roles: [
                {
                    role: 'admin',
                    members: [user1_loggedIn._id]
                }
            ]
        }
    ];

    const organizations = await Promise.all(organizationsData.map(org => createOrganization(user1_loggedIn.jwt, org)));

    const brainlifeAdmin = {
        jwt: ""
    }

    const allOrganizations = await axios.get(`${host}/organization`, {
        headers: {
            Authorization: `Bearer ${brainlifeAdmin.jwt}`
        }
    });

    console.log('All organizations:', allOrganizations.data);

    updateOrganization(brainlifeAdmin.jwt, organizations[0]._id, { name: 'Updated Organization One' });

    const updatedOrgOne = await getOrganization(brainlifeAdmin.jwt, organizations[0]._id);

    if (updatedOrgOne.name === 'Updated Organization One') {
        console.log('Organization One updated successfully');
    }

    // //{
    //     name: 'Organization One',
    //     owner: user1_loggedIn._id,
    //     roles: [
    //         {
    //             role: 'admin',
    //             members: [user1_loggedIn._id]
    //         }
    //     ]
    // }, Lets invite user2 to Organization One as a member

    const inviteUser2_ORG1 = await inviteUserToOrganization(user1_loggedIn.jwt, organizations[0]._id, user2_loggedIN._id, 'member');
    console.log('User 2 invited to Organization One as a member', inviteUser2_ORG1);

    // check for it to fail upon re-invitation
    const reInviteUser2_ORG1 = await inviteUserToOrganization(user1_loggedIn.jwt, organizations[0]._id, user2_loggedIN._id, 'member');

    console.log('User 2 re-invited to Organization One as a member', reInviteUser2_ORG1);

    deleteOrganization(brainlifeAdmin.jwt, organizations[1]._id);

    const deletedOrgTwo = await getOrganization(brainlifeAdmin.jwt, organizations[1]._id);

    if (deletedOrgTwo.removed === true) {
        console.log('Organization Two deleted successfully');
    }

};


executeWorkflow().catch(console.error);


