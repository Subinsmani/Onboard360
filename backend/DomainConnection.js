const express = require('express');
const mysql = require('mysql2');
const ldap = require('ldapjs');
require('dotenv').config();
const { encryptPassword, decryptPassword } = require('./utils/encryption');

const router = express.Router();

// **Database Connection Using `createPool`**
const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// **Ensure Domains Table Exists**
db.getConnection((err, connection) => {
    if (err) {
        console.error("Database Connection Failed:", err);
        return;
    }

    const createDomainsTableQuery = `
        CREATE TABLE IF NOT EXISTS Domains (
            id INT AUTO_INCREMENT PRIMARY KEY,
            domain_name VARCHAR(255) NOT NULL UNIQUE,
            domain_controller VARCHAR(255) NOT NULL,
            read_only_user VARCHAR(255) NOT NULL,
            read_only_user_password TEXT NOT NULL,
            base_dn VARCHAR(255) NOT NULL,
            ssl_enabled ENUM('Yes', 'No') NOT NULL DEFAULT 'No',
            port INT NOT NULL,
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

    connection.query(createDomainsTableQuery, (err) => {
        if (err) {
            console.error("Error ensuring Domains table exists:", err);
        }
    });
});

// **Get All Domains**
router.get('/domains', (req, res) => {
    const sql = `SELECT id, domain_name, domain_controller, read_only_user, base_dn, ssl_enabled, port, created_date FROM Domains`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(" Database error while fetching domains:", err);
            return res.status(500).json({ error: " Database error." });
        }
        res.json(results);
    });
});

// **Get Stored Password for a Domain**
router.get('/domains/:id/password', (req, res) => {
    const { id } = req.params;
    const sql = `SELECT read_only_user_password FROM Domains WHERE id = ?`;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(" Error fetching stored password:", err);
            return res.status(500).json({ error: " Database error." });
        }
        if (result.length === 0) {
            return res.status(404).json({ error: " Domain not found." });
        }

        // Decrypt the password before sending it back
        const decryptedPassword = decryptPassword(result[0].read_only_user_password);
        res.json({ password: decryptedPassword });
    });
});

// **Add a New Domain with Encrypted Password**
router.post('/domains', async (req, res) => {
    const { domain_name, domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = req.body;

    if (!domain_name || !domain_controller || !read_only_user || !read_only_user_password || !base_dn || !ssl_enabled || !port) {
        return res.status(400).json({ error: " All fields are required." });
    }

    try {
        //**Encrypt Password Before Storing**
        const encryptedPassword = encryptPassword(read_only_user_password);

        const insertSql = `INSERT INTO Domains (domain_name, domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port) 
                           VALUES (?, ?, ?, ?, ?, ?, ?)`;

        db.query(insertSql, [domain_name, domain_controller, read_only_user, encryptedPassword, base_dn, ssl_enabled, port], (err, result) => {
            if (err) {
                console.error(" Error inserting domain:", err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: "Domain added successfully!", domainId: result.insertId });
        });

    } catch (error) {
        console.error("Error encrypting password:", error);
        res.status(500).json({ error: "Error encrypting password." });
    }
});

// **Update Domain (Keep Old Password If Not Provided)**
router.put('/domains/:id', async (req, res) => {
    const { id } = req.params;
    const { domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = req.body;

    if (!domain_controller || !read_only_user || !base_dn || !ssl_enabled || !port) {
        return res.status(400).json({ error: "All fields are required for updating." });
    }

    try {
        let sql, params;

        if (read_only_user_password) {
            //Encrypt new password if provided
            const encryptedPassword = encryptPassword(read_only_user_password);
            sql = `UPDATE Domains SET domain_controller=?, read_only_user=?, read_only_user_password=?, base_dn=?, ssl_enabled=?, port=? WHERE id=?`;
            params = [domain_controller, read_only_user, encryptedPassword, base_dn, ssl_enabled, port, id];
        } else {
            sql = `UPDATE Domains SET domain_controller=?, read_only_user=?, base_dn=?, ssl_enabled=?, port=? WHERE id=?`;
            params = [domain_controller, read_only_user, base_dn, ssl_enabled, port, id];
        }

        db.query(sql, params, (err) => {
            if (err) return res.status(500).json({ error: "Error updating domain." });
            res.json({ message: "Domain updated successfully!" });
        });

    } catch (error) {
        res.status(500).json({ error: " Error updating domain." });
    }
});

// **Test Active Directory Connection (LDAP Authentication)**
router.post('/test-ad-connection', async (req, res) => {
    let { domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = req.body;

    if (!domain_controller || !read_only_user || !base_dn || !ssl_enabled || !port) {
        return res.status(400).json({ success: false, message: "All fields are required for testing." });
    }

    let resSent = false; // Flag to track response status

    try {
        if (!read_only_user_password) {
            const [rows] = await db.promise().query("SELECT read_only_user_password FROM Domains WHERE read_only_user = ?", [read_only_user]);
            if (rows.length > 0) {
                read_only_user_password = decryptPassword(rows[0].read_only_user_password);
            } else {
                console.error("No stored password found.");
                return res.status(401).json({ success: false, message: "No stored password found." });
            }
        }

        const ldapUrl = `${ssl_enabled === "Yes" ? "ldaps" : "ldap"}://${domain_controller}:${port}`;
        const client = ldap.createClient({
            url: ldapUrl,
            timeout: 5000, 
            connectTimeout: 5000
        });

        client.on('error', (err) => {
            if (!resSent) {
                resSent = true;
                console.error(`LDAP Connection Error: ${err.message}`);
                return res.status(500).json({ success: false, message: "LDAP Connection Failed", error: err.message });
            }
        });

        client.bind(read_only_user, read_only_user_password, (err) => {
            if (err) {
                if (!resSent) {
                    resSent = true;
                    console.error(`LDAP Bind Failed: ${err.message}`);
                    return res.status(401).json({ success: false, message: "Invalid credentials or domain unreachable." });
                }
            } else {
                if (!resSent) {
                    resSent = true;
                    res.json({ success: true, message: "✅ Connection successful!" });
                }
                client.unbind();
            }
        });

    } catch (error) {
        if (!resSent) {
            resSent = true;
            console.error("LDAP Test Error:", error);
            res.status(500).json({ success: false, message: "Error testing LDAP connection." });
        }
    }
});

// **Get Domain Status**
router.get('/domains/:id/status', async (req, res) => {
    const { id } = req.params;
    let resSent = false; // Prevent duplicate responses

    const sql = `SELECT domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port FROM Domains WHERE id = ?`;
    db.query(sql, [id], async (err, result) => {
        if (err) {
            console.error("Error fetching domain details:", err);
            if (!resSent) {
                resSent = true;
                return res.status(500).json({ error: "Database error." });
            }
        }
        if (result.length === 0) {
            if (!resSent) {
                resSent = true;
                return res.status(404).json({ error: "Domain not found." });
            }
        }

        const { domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = result[0];
        const decryptedPassword = decryptPassword(read_only_user_password);

        try {
            const ldapUrl = `${ssl_enabled === "Yes" ? "ldaps" : "ldap"}://${domain_controller}:${port}`;
            const client = ldap.createClient({
                url: ldapUrl,
                timeout: 5000,  
                connectTimeout: 5000 
            });

            client.on('error', (err) => {
                if (!resSent) {
                    resSent = true;
                    console.error(`LDAP Connection Error: ${err.message}`);
                    return res.json({ status: "Inactive", error: err.message });
                }
            });

            client.bind(read_only_user, decryptedPassword, (err) => {
                if (err) {
                    if (!resSent) {
                        resSent = true;
                        console.error(`Domain ${id} unreachable: ${err.message}`);
                        return res.json({ status: "Inactive", error: err.message });
                    }
                } else {
                    if (!resSent) {
                        resSent = true;
                        res.json({ status: "Active" });
                    }
                    client.unbind();
                }
            });

        } catch (error) {
            if (!resSent) {
                resSent = true;
                console.error("LDAP Connection Error:", error);
                res.json({ status: "Inactive", error: error.message });
            }
        }
    });
});

router.get('/ou', async (req, res) => {
    const { domain_id } = req.query;
    if (!domain_id) {
        console.error("❌ Missing domain_id");
        return res.status(400).json({ error: "Domain ID is required." });
    }

    // Fetch domain details from the database
    const sql = `SELECT domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port FROM Domains WHERE id = ?`;

    db.query(sql, [domain_id], async (err, result) => {
        if (err) {
            console.error("❌ Database error while fetching domain details:", err);
            return res.status(500).json({ error: "Database error." });
        }
        if (result.length === 0) {
            console.warn("⚠️ Domain not found for ID:", domain_id);
            return res.status(404).json({ error: "Domain not found." });
        }

        let { domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = result[0];

        // Adjust Base DN if too specific
        if (!base_dn || !base_dn.toLowerCase().includes("dc=")) {
            console.warn("⚠️ Base DN is too specific or missing. Defaulting to domain root.");
            base_dn = `DC=BCS,DC=local`;
        }

        // Decrypt stored password
        const decryptedPassword = decryptPassword(read_only_user_password);

        try {
            const ldapUrl = `${ssl_enabled === "Yes" ? "ldaps" : "ldap"}://${domain_controller}:${port}`;

            // Create LDAP client using ldapjs
            const client = ldap.createClient({
                url: ldapUrl,
                timeout: 5000,       // 5 seconds timeout for search
                connectTimeout: 5000 // 5 seconds timeout for connection
            });

            // Handle client-level errors
            client.on('error', (err) => {
                console.error(`❌ LDAP Client Error: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: "LDAP Client Error", details: err.message });
                }
            });

            // Bind to the LDAP server
            client.bind(read_only_user, decryptedPassword, (err) => {
                if (err) {
                    console.error(`❌ LDAP Bind Error: ${err.message}`);
                    if (!res.headersSent) {
                        res.json({ status: "Inactive", error: err.message });
                    }
                    client.unbind();
                    return;
                }

                // Define search options with a simple filter string
                const filter = '(objectClass=organizationalUnit)';
                const searchOptions = {
                    scope: 'sub',
                    filter: filter,
                    attributes: ['ou', 'distinguishedName'] // Specify desired attributes
                };

                let ouTree = [];

                // Perform the search
                client.search(base_dn, searchOptions, (err, searchRes) => {
                    if (err) {
                        console.error('❌ LDAP Search Error:', err);
                        if (!res.headersSent) {
                            res.status(500).json({ error: "LDAP Search Error", details: err.message });
                        }
                        client.unbind();
                        return;
                    }

                    // Handle each search entry
                    searchRes.on('searchEntry', (entry) => {
                        const attributes = entry.attributes;
                        const entryObject = {};

                        attributes.forEach(attr => {
                            // Handle multi-valued attributes
                            entryObject[attr.type.toLowerCase()] = attr.values.length > 1 ? attr.values : attr.values[0];
                        });

                        // Validate essential attributes
                        if (entryObject.ou && entryObject.distinguishedname) {
                            ouTree.push({ id: entryObject.distinguishedname, name: entryObject.ou, children: [] });
                        }
                    });

                    // Handle search end
                    searchRes.on('end', () => {
                        res.json(ouTree);
                        client.unbind();
                    });

                    // Handle search errors
                    searchRes.on('error', (err) => {
                        console.error('❌ LDAP Search Error:', err);
                        if (!res.headersSent) {
                            res.status(500).json({ error: "LDAP Search Error", details: err.message });
                        }
                        client.unbind();
                    });
                });
            });

        } catch (error) {
            console.error("❌ LDAP Connection Error:", error);
            res.status(500).json({ error: "Error connecting to LDAP.", details: error.message });
        }
    });
});

// Function to convert LDAP Generalized Time to MySQL-friendly format
function formatLdapTimestamp(ldapTimestamp) {
    if (!ldapTimestamp) return null;
    const match = ldapTimestamp.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

// Helper function to convert Buffer to GUID string
function bufferToGuid(buffer) {
    const hex = buffer.toString('hex');
    return `${hex.substring(6, 8)}${hex.substring(4, 6)}${hex.substring(2, 4)}${hex.substring(0, 2)}-${hex.substring(10, 12)}${hex.substring(8, 10)}-${hex.substring(14, 16)}${hex.substring(12, 14)}-${hex.substring(16, 18)}-${hex.substring(18, 32)}`;
}

// Helper function to convert Buffer to SID string
function bufferToSID(buffer) {
    const revision = buffer.readUInt8(0);
    const subAuthorityCount = buffer.readUInt8(1);
    let identifierAuthority = 0;
    for (let i = 2; i < 8; i++) {
        identifierAuthority = identifierAuthority * 256 + buffer.readUInt8(i);
    }
    let sid = `S-${revision}-${identifierAuthority}`;
    for (let i = 8; i < buffer.length; i += 4) {
        sid += `-${buffer.readUInt32LE(i)}`;
    }
    return sid;
}

// Ensure ldap_users table exists before inserting data
const ensureTableExists = () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ldap_users (
            samaccountname VARCHAR(255) PRIMARY KEY,
            userprincipalname VARCHAR(255),
            cn VARCHAR(255),
            displayname VARCHAR(255),
            givenname VARCHAR(255),
            sn VARCHAR(255),
            distinguishedname TEXT,
            objectguid VARCHAR(255),
            objectsid VARCHAR(255),
            memberof TEXT,
            useraccountcontrol INT,
            accountexpires BIGINT,
            pwdlastset BIGINT,
            badpasswordtime BIGINT,
            badpwdcount INT,
            lastlogon BIGINT,
            lastlogontimestamp BIGINT,
            logoncount INT,
            admincount INT,
            mail VARCHAR(255),
            mobile VARCHAR(255),
            telephonenumber VARCHAR(255),
            title VARCHAR(255),
            department VARCHAR(255),
            company VARCHAR(255),
            manager TEXT,
            streetaddress TEXT,
            l VARCHAR(255),
            st VARCHAR(255),
            postalcode VARCHAR(255),
            co VARCHAR(255),
            primarygroupid INT,
            whencreated DATETIME,
            whenchanged DATETIME
        );
    `;

    db.query(createTableQuery, (err) => {
        if (err) {
            console.error("❌ Error creating ldap_users table:", err);
        } else {
            console.log("✅ ldap_users table is ready.");
        }
    });
};

// Call this function before inserting users
ensureTableExists();

// Fetch LDAP users and insert into the database
router.get("/ldapusers", async (req, res) => {
    const { domain_id, ous } = req.query;

    if (!domain_id || !ous) {
        return res.status(400).json({ error: "Domain ID and OUs are required." });
    }

    const ouList = Array.isArray(ous) ? ous : [ous];

    db.query(
        "SELECT domain_controller, read_only_user, read_only_user_password, ssl_enabled, port FROM Domains WHERE id = ?",
        [domain_id],
        async (err, result) => {
            if (err) {
                return res.status(500).json({ error: "Database error." });
            }
            if (result.length === 0) {
                return res.status(404).json({ error: "Domain not found." });
            }

            const { domain_controller, read_only_user, read_only_user_password, ssl_enabled, port } = result[0];
            const decryptedPassword = decryptPassword(read_only_user_password);
            const ldapUrl = `${ssl_enabled === "Yes" ? "ldaps" : "ldap"}://${domain_controller}:${port}`;

            const client = ldap.createClient({ url: ldapUrl, timeout: 5000, connectTimeout: 5000 });

            client.on("error", () => {});

            client.bind(read_only_user, decryptedPassword, (err) => {
                if (err) {
                    client.unbind();
                    return res.status(503).json({ error: "LDAP connection failed. Please try again later." });
                }

                let users = [];
                let pendingRequests = ouList.length;
                let hasResponded = false;

                const checkAndRespond = () => {
                    if (pendingRequests === 0 && !hasResponded) {
                        hasResponded = true;
                        client.unbind();
                        return res.json(users);
                    }
                };

                ouList.forEach((ou) => {
                    const searchOptions = {
                        scope: "sub",
                        filter: "(objectClass=user)",
                        attributes: [
                            "samaccountname", "userprincipalname", "cn", "displayname", "givenname", "sn",
                            "distinguishedname", "objectguid", "objectsid", "memberof", "useraccountcontrol",
                            "accountexpires", "pwdlastset", "badpasswordtime", "badpwdcount",
                            "lastlogon", "lastlogontimestamp", "logoncount", "admincount",
                            "mail", "mobile", "telephoneNumber", "title", "department", "company", "manager",
                            "streetaddress", "l", "st", "postalcode", "co", "primarygroupid",
                            "whenCreated", "whenChanged"
                        ]
                    };

                    client.search(ou, searchOptions, (searchErr, searchRes) => {
                        if (searchErr) {
                            pendingRequests--;
                            checkAndRespond();
                            return;
                        }

                        searchRes.on("searchEntry", (entry) => {
                            const attributes = entry.attributes;
                            const entryObject = {};

                            attributes.forEach(attr => {
                                if (attr.type.toLowerCase() === 'objectguid') {
                                    entryObject[attr.type.toLowerCase()] = bufferToGuid(attr.buffers[0]);
                                } else if (attr.type.toLowerCase() === 'objectsid') {
                                    entryObject[attr.type.toLowerCase()] = bufferToSID(attr.buffers[0]);
                                } else {
                                    entryObject[attr.type.toLowerCase()] = attr.values.length > 1 ? attr.values.join(", ") : attr.values[0];
                                }
                            });

                            entryObject.whencreated = formatLdapTimestamp(entryObject.whencreated);
                            entryObject.whenchanged = formatLdapTimestamp(entryObject.whenchanged);

                            users.push(entryObject);

                            const userValues = [
                                entryObject.samaccountname || null,
                                entryObject.userprincipalname || null,
                                entryObject.cn || null,
                                entryObject.displayname || null,
                                entryObject.givenname || null,
                                entryObject.sn || null,
                                entryObject.distinguishedname || null,
                                entryObject.objectguid || null,
                                entryObject.objectsid || null,
                                entryObject.memberof || null,
                                entryObject.useraccountcontrol || null,
                                entryObject.accountexpires || null,
                                entryObject.pwdlastset || null,
                                entryObject.badpasswordtime || null,
                                entryObject.badpwdcount || null,
                                entryObject.lastlogon || null,
                                entryObject.lastlogontimestamp || null,
                                entryObject.logoncount || null,
                                entryObject.admincount || null,
                                entryObject.mail || null,
                                entryObject.mobile || null,
                                entryObject.telephonenumber || null,
                                entryObject.title || null,
                                entryObject.department || null,
                                entryObject.company || null,
                                entryObject.manager || null,
                                entryObject.streetaddress || null,
                                entryObject.l || null,
                                entryObject.st || null,
                                entryObject.postalcode || null,
                                entryObject.co || null,
                                entryObject.primarygroupid || null,
                                entryObject.whencreated || null,
                                entryObject.whenchanged || null
                            ];

                            const insertQuery = `
                                INSERT INTO ldap_users (
                                    samaccountname, userprincipalname, cn, displayname, givenname, sn, distinguishedname,
                                    objectguid, objectsid, memberof, useraccountcontrol, accountexpires, pwdlastset,
                                    badpasswordtime, badpwdcount, lastlogon, lastlogontimestamp, logoncount, admincount,
                                    mail, mobile, telephonenumber, title, department, company, manager, streetaddress,
                                    l, st, postalcode, co, primarygroupid, whencreated, whenchanged
                                ) VALUES (${userValues.map(() => "?").join(", ")})
                                ON DUPLICATE KEY UPDATE userprincipalname = VALUES(userprincipalname);
                            `;

                            db.query(insertQuery, userValues, () => {});
                        });

                        searchRes.on("end", () => {
                            pendingRequests--;
                            checkAndRespond();
                        });

                        searchRes.on("error", () => {
                            pendingRequests--;
                            checkAndRespond();
                        });
                    });
                });
            });
        }
    );
});

router.get('/domainusers', (req, res) => {
    const sql = `
        SELECT 
            samaccountname, 
            userprincipalname,
            useraccountcontrol,
            whencreated,
            cn, 
            displayname, 
            givenname, 
            sn, 
            memberof, 
            mail, 
            mobile, 
            title, 
            department, 
            company 
        FROM ldap_users
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: "Database error while fetching domain users." });
        }
        res.json(results);
    });
});

module.exports = router;
