const express = require('express');
const ldap = require('ldapjs');
const { encryptPassword, decryptPassword } = require('../../utils/encryption');
const db = require('../../db'); // Ensure db is a Promise-based client

const router = express.Router();

// Function to extract DC Name from base_dn
function extractDcName(baseDn) {
    const matches = baseDn.match(/DC=([^,]+)/);
    return matches ? matches[1] : null;
}

// **Get All Domains**
router.get('/domains', async (req, res) => {
    const sql = `SELECT id, domain_name, domain_controller, read_only_user, base_dn, dc_name, ssl_enabled, port, created_date FROM Domains`;

    try {
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error("Database error while fetching domains:", err);
        res.status(500).json({ error: "Database error." });
    }
});

// **Get Stored Password for a Domain**
router.get('/domains/:id/password', async (req, res) => {
    const { id } = req.params;
    const sql = `SELECT read_only_user_password FROM Domains WHERE id = ?`;

    try {
        const [result] = await db.query(sql, [id]);
        if (result.length === 0) {
            return res.status(404).json({ error: "Domain not found." });
        }

        // Decrypt the password before sending it back
        const decryptedPassword = decryptPassword(result[0].read_only_user_password);
        res.json({ password: decryptedPassword });
    } catch (err) {
        console.error("Error fetching stored password:", err);
        res.status(500).json({ error: "Database error." });
    }
});

// **Add a New Domain with Encrypted Password**
router.post('/domains', async (req, res) => {
    const { domain_name, domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = req.body;

    if (!domain_name || !domain_controller || !read_only_user || !read_only_user_password || !base_dn || !ssl_enabled || !port) {
        return res.status(400).json({ error: "All fields are required." });
    }

    try {
        // Encrypt password before storing
        const encryptedPassword = encryptPassword(read_only_user_password);

        // Extract dc_name from base_dn
        const dc_name = extractDcName(base_dn);
        if (!dc_name) {
            return res.status(400).json({ error: "Invalid base_dn format. Cannot extract dc_name." });
        }

        const insertSql = `INSERT INTO Domains (domain_name, domain_controller, read_only_user, read_only_user_password, base_dn, dc_name, ssl_enabled, port) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        const [result] = await db.query(insertSql, [domain_name, domain_controller, read_only_user, encryptedPassword, base_dn, dc_name, ssl_enabled, port]);
        res.json({ message: "Domain added successfully!", domainId: result.insertId, dc_name });

    } catch (error) {
        console.error("Error inserting domain:", error);
        res.status(500).json({ error: error.message });
    }
});

// **Update Domain API (Keeps Old Password If Not Provided)**
router.put('/domains/:id', async (req, res) => {
    const { id } = req.params;
    const { domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = req.body;

    if (!domain_controller || !read_only_user || !base_dn || !ssl_enabled || !port) {
        return res.status(400).json({ error: "All required fields must be provided for update." });
    }

    try {
        // Extract dc_name from base_dn
        const dc_name = extractDcName(base_dn);
        if (!dc_name) {
            return res.status(400).json({ error: "Invalid base_dn format. Cannot extract dc_name." });
        }

        let sql, params;

        if (read_only_user_password) {
            // Encrypt new password if provided
            const encryptedPassword = encryptPassword(read_only_user_password);
            sql = `UPDATE Domains SET domain_controller=?, read_only_user=?, read_only_user_password=?, base_dn=?, dc_name=?, ssl_enabled=?, port=? WHERE id=?`;
            params = [domain_controller, read_only_user, encryptedPassword, base_dn, dc_name, ssl_enabled, port, id];
        } else {
            sql = `UPDATE Domains SET domain_controller=?, read_only_user=?, base_dn=?, dc_name=?, ssl_enabled=?, port=? WHERE id=?`;
            params = [domain_controller, read_only_user, base_dn, dc_name, ssl_enabled, port, id];
        }

        await db.query(sql, params);
        res.json({ message: "Domain updated successfully!", dc_name });

    } catch (error) {
        console.error("Error updating domain:", error);
        res.status(500).json({ error: error.message });
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
            const [rows] = await db.query("SELECT read_only_user_password FROM Domains WHERE read_only_user = ?", [read_only_user]);
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
    try {
        const [result] = await db.query(sql, [id]);
        if (result.length === 0) {
            return res.status(404).json({ error: "Domain not found." });
        }

        const { domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port } = result[0];
        const decryptedPassword = decryptPassword(read_only_user_password);

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

// **Fetch Organizational Units (OUs)**
router.get('/ou', async (req, res) => {
    const { domain_id } = req.query;
    if (!domain_id) {
        console.error("❌ Missing domain_id");
        return res.status(400).json({ error: "Domain ID is required." });
    }

    try {
        // Fetch domain details from the database
        const sql = `SELECT domain_controller, read_only_user, read_only_user_password, base_dn, ssl_enabled, port FROM Domains WHERE id = ?`;
        const [result] = await db.query(sql, [domain_id]);

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

// **Fetch LDAP Users and Insert into the Database**
router.get("/ldapusers", async (req, res) => {
    const { domain_id, ous } = req.query;

    if (!domain_id || !ous) {
        return res.status(400).json({ error: "Domain ID and OUs are required." });
    }

    const ouList = Array.isArray(ous) ? ous : [ous];

    try {
        // Fetch domain details including dc_name
        const [domains] = await db.query(
            "SELECT domain_controller, read_only_user, read_only_user_password, ssl_enabled, port, dc_name FROM Domains WHERE id = ?",
            [domain_id]
        );

        if (domains.length === 0) {
            return res.status(404).json({ error: "Domain not found." });
        }

        const { domain_controller, read_only_user, read_only_user_password, ssl_enabled, port, dc_name } = domains[0];
        const decryptedPassword = decryptPassword(read_only_user_password);
        const ldapUrl = `${ssl_enabled === "Yes" ? "ldaps" : "ldap"}://${domain_controller}:${port}`;

        const client = ldap.createClient({ url: ldapUrl, timeout: 5000, connectTimeout: 5000 });

        client.on("error", (err) => {
            console.error("❌ LDAP Client Error:", err.message);
            return res.status(500).json({ error: "LDAP Client Error", details: err.message });
        });

        client.bind(read_only_user, decryptedPassword, async (err) => {
            if (err) {
                console.error("❌ LDAP Bind Error:", err.message);
                client.unbind();
                return res.status(401).json({ error: "LDAP bind failed. Check credentials." });
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

            for (const ou of ouList) {
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

                client.search(ou, searchOptions, async (searchErr, searchRes) => {
                    if (searchErr) {
                        console.error(`❌ LDAP Search Error for OU ${ou}:`, searchErr.message);
                        pendingRequests--;
                        checkAndRespond();
                        return;
                    }

                    searchRes.on("searchEntry", async (entry) => {
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
                            entryObject.whenchanged || null,
                            dc_name
                        ];

                        const insertQuery = `
                            INSERT INTO ldap_users (
                                samaccountname, userprincipalname, cn, displayname, givenname, sn, distinguishedname,
                                objectguid, objectsid, memberof, useraccountcontrol, accountexpires, pwdlastset,
                                badpasswordtime, badpwdcount, lastlogon, lastlogontimestamp, logoncount, admincount,
                                mail, mobile, telephonenumber, title, department, company, manager, streetaddress,
                                l, st, postalcode, co, primarygroupid, whencreated, whenchanged, dc_name
                            ) VALUES (${userValues.map(() => "?").join(", ")})
                            ON DUPLICATE KEY UPDATE 
                                userprincipalname = VALUES(userprincipalname),
                                cn = VALUES(cn),
                                displayname = VALUES(displayname),
                                givenname = VALUES(givenname),
                                sn = VALUES(sn),
                                distinguishedname = VALUES(distinguishedname),
                                objectguid = VALUES(objectguid),
                                objectsid = VALUES(objectsid),
                                memberof = VALUES(memberof),
                                useraccountcontrol = VALUES(useraccountcontrol),
                                accountexpires = VALUES(accountexpires),
                                pwdlastset = VALUES(pwdlastset),
                                badpasswordtime = VALUES(badpasswordtime),
                                badpwdcount = VALUES(badpwdcount),
                                lastlogon = VALUES(lastlogon),
                                lastlogontimestamp = VALUES(lastlogontimestamp),
                                logoncount = VALUES(logoncount),
                                admincount = VALUES(admincount),
                                mail = VALUES(mail),
                                mobile = VALUES(mobile),
                                telephonenumber = VALUES(telephonenumber),
                                title = VALUES(title),
                                department = VALUES(department),
                                company = VALUES(company),
                                manager = VALUES(manager),
                                streetaddress = VALUES(streetaddress),
                                l = VALUES(l),
                                st = VALUES(st),
                                postalcode = VALUES(postalcode),
                                co = VALUES(co),
                                primarygroupid = VALUES(primarygroupid),
                                whencreated = VALUES(whencreated),
                                whenchanged = VALUES(whenchanged),
                                dc_name = VALUES(dc_name)
                        `;

                        try {
                            await db.query(insertQuery, userValues);
                        } catch (dbErr) {
                            console.error("❌ Database Insert Error:", dbErr.message);
                        }
                    });

                    searchRes.on("end", () => {
                        pendingRequests--;
                        checkAndRespond();
                    });

                    searchRes.on("error", (err) => {
                        console.error(`❌ LDAP Search Error during search of OU ${ou}:`, err.message);
                        pendingRequests--;
                        checkAndRespond();
                    });
                });
            }
        });

    } catch (err) {
        console.error("❌ Error fetching LDAP users:", err.message);
        res.status(500).json({ error: "Error fetching LDAP users.", details: err.message });
    }
});

// **Get Domain Users**
router.get('/domainusers', async (req, res) => {
    const sql = `
        SELECT 
            ldap_user_id,
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
            company,
            dc_name
        FROM ldap_users
    `;

    try {
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error("Database error while fetching domain users:", err);
        res.status(500).json({ error: "Database error while fetching domain users." });
    }
});

module.exports = router;
