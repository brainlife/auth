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

// Function to login a user
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

// Function to handle the signup and login process
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

// const host = 'http://localhost:8080/api/auth';
const signupUrl = `${host}/signup`;

const user1 = {
    email: 'user1@example.com',
    username: 'user1',
    password: 'password123TEST'
};

const user2 = {
    email: 'user2@example.com',
    username: 'user2',
    password: 'password456TEST'
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
};


executeWorkflow().catch(console.error);


