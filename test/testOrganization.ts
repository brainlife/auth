const axios = require('axios');

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
            console.log(`User ${user.username} signed up with sub: ${signupResponse.sub}`);

            const loginResponse = await loginUser(user);
            console.log(`User ${user.username} logged in with JWT: ${loginResponse.jwt}`);

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




const executeWorkflow = async () => {
    const users = await handleSignupAndLogin();
    const user1_loggedIn = users[0];
    const user2_loggedIN = users[1];

    let organizationData = {
        name: 'New Organization',
        roles: [
            {
                role: 'admin',
                members: [user2_loggedIN.sub]
            }
        ],
        owner: user1_loggedIn.sub
    }

    organizationData.roles[0].members.push(user1_loggedIn.sub);

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

    await deleteOrganization(user1_loggedIn.jwt, organization._id);

    const deletedOrg = await getOrganization(user1_loggedIn.jwt, organization._id);
    if (deletedOrg.removed === true) {
        console.log('Organization deleted successfully');
    }

    const organizationsData = [
        {
            name: 'Organization One',
            owner: user1_loggedIn.sub,
            roles: [
                {
                    role: 'admin',
                    members: [user1_loggedIn.sub]
                }
            ]
        },
        {
            name: 'Organization Two',
            owner: user1_loggedIn.sub,
            roles: [
                {
                    role: 'admin',
                    members: [user1_loggedIn.sub]
                }
            ]
        }
    ];

    const organizations = await Promise.all(organizationsData.map(org => createOrganization(user1_loggedIn.jwt, org)));

    const brainlifeAdmin = {
        jwt: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDk4NDE1MDUsInNjb3BlcyI6eyJicmFpbmxpZmUiOlsiYWRtaW4iXX0sInN1YiI6MTAsImdpZHMiOlswXSwicHJvZmlsZSI6eyJ1c2VybmFtZSI6InRlc3ROYW1lIiwiZW1haWwiOiJ0ZXN0TmFtZUB0ZXN0LmlvIn0sImlhdCI6MTcwOTIzNjcwNX0.fGYNnD9Keks55DHd_pu99hmWBoj50FV5zqGc-2w-4EtRyFM8f2gSpOJJgzOeYPHnS_0zRxDEkjEKGH8eT6CaYNfU0JYtMAmV9eOc3ricDIyzcSy_wDTE5aoTkpWOkQmNxIiEOi04STAX29iUXvIpSU5CwCbTweR89PD9_PYezDBtFJmp1Oxhy0i2e2anH41GA4IYgTZIDgc0UHa88fCCyk1x-kQWSWBaiECw4Bz0stVlAb_4JBmpkal62ra9vqG4uM2jYJSpDum4ilxI5keKt2uUi6DWD9ZyuieGZ8DueIqKeuP8hCFE62eHWdzysxoHd6-6LnV9lp_SCEwmJ4n6uw'
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

    deleteOrganization(brainlifeAdmin.jwt, organizations[1]._id);

    const deletedOrgTwo = await getOrganization(brainlifeAdmin.jwt, organizations[1]._id);

    if (deletedOrgTwo.removed === true) {
        console.log('Organization Two deleted successfully');
    }

};


executeWorkflow().catch(console.error);


