<script lang="ts">
  const lastUpdated = "July 7, 2025";
</script>

<svelte:head>
  <title>Privacy Policy - Blockate Audio Database</title>
  <meta name="description" content="Privacy Policy for Blockate Audio Database - How we collect, use, and protect your Roblox data" />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
  <div class="prose prose-invert max-w-none">
    <h1 class="text-4xl font-bold mb-8">Privacy Policy</h1>
    
    <p class="text-sm text-gray-400 mb-8">Last updated: {lastUpdated}</p>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">1. Introduction</h2>
      <p>
        This Privacy Policy explains how Blockate Audio Database ("we," "our," or "us") collects, 
        uses, and protects your personal information when you use our service. We are committed to 
        protecting your privacy and handling your data responsibly.
      </p>
      <p>
        Our application integrates with Roblox through OAuth 2.0 authentication, which means we 
        receive certain information about you from Roblox when you grant us permission. Roblox is 
        the source of your authenticated user data, including your user ID, username, display name, 
        and avatar information.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">2. What Data We Collect</h2>
      
      <h3 class="text-xl font-semibold mb-3">openid Scope:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>User ID:</strong> Your unique Roblox user identifier, required for authentication and account management</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">profile Scope:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>Username:</strong> Your Roblox username for display and personalization</li>
        <li><strong>Display Name:</strong> Your Roblox display name for enhanced user experience</li>
        <li><strong>Avatar URL:</strong> Link to your Roblox avatar image for profile display</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Technical Data:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>Session Information:</strong> Secure session tokens for maintaining your login state</li>
        <li><strong>OAuth Tokens:</strong> Access and refresh tokens for API communication with Roblox</li>
        <li><strong>Usage Data:</strong> Basic application usage patterns for service improvement</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Data We Do NOT Collect:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li>Your Roblox password or other authentication credentials</li>
        <li>Personal information beyond what's provided through OAuth scopes</li>
        <li>Financial or payment information</li>
        <li>Private messages or communications</li>
        <li>Detailed browsing history outside our application</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">3. How We Collect Data</h2>
      <p>
        We collect your data exclusively through Roblox's OAuth 2.0 consent screen when you choose 
        to authorize our application. The data collection process involves:
      </p>
      <ul class="list-disc pl-6 mb-4">
        <li>You clicking "Login with Roblox" on our application</li>
        <li>Being redirected to Roblox's secure authorization page</li>
        <li>Reviewing and accepting the requested permissions (scopes)</li>
        <li>Roblox providing us with the authorized data through secure API calls</li>
      </ul>
      <p>
        We use PKCE (Proof Key for Code Exchange) to ensure the security of this process and 
        prevent unauthorized access to your data.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">4. How We Use Your Data</h2>
      <p>We use your data for the following specific purposes:</p>
      
      <h3 class="text-xl font-semibold mb-3">Core Functionality:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>Authentication:</strong> Verifying your identity and maintaining secure login sessions</li>
        <li><strong>Personalization:</strong> Displaying your username and avatar throughout the application</li>
        <li><strong>Audio Management:</strong> Associating audio content and preferences with your account</li>
        <li><strong>User Experience:</strong> Providing a customized interface based on your profile</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Token Management:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li>Storing access tokens securely for authorized API calls to Roblox</li>
        <li>Using refresh tokens to maintain your session without requiring frequent re-authentication</li>
        <li>Automatically refreshing expired tokens to ensure seamless service</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Service Improvement:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li>Analyzing usage patterns to improve application performance</li>
        <li>Identifying and fixing technical issues</li>
        <li>Developing new features based on user needs</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">5. Data Sharing & Disclosure</h2>
      <p><strong>We do not sell or share your Roblox account data with third parties.</strong></p>
      
      <h3 class="text-xl font-semibold mb-3">Limited Third-Party Services:</h3>
      <p>We may use the following types of services that could have access to limited data:</p>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>Database Hosting:</strong> Secure cloud database services for data storage</li>
        <li><strong>Application Hosting:</strong> Cloud platforms for running our application</li>
      </ul>
      
      <h3 class="text-xl font-semibold mb-3">Legal Requirements:</h3>
      <p>We may disclose your information only when required by law or to:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Comply with legal processes or government requests</li>
        <li>Protect our rights, property, or safety</li>
        <li>Protect the rights, property, or safety of our users</li>
        <li>Investigate potential violations of our Terms of Service</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">6. Data Retention</h2>
      
      <h3 class="text-xl font-semibold mb-3">User Data:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>Active Accounts:</strong> We retain your profile data as long as your account remains active</li>
        <li><strong>Inactive Accounts:</strong> Accounts inactive for more than 2 years may be automatically deleted</li>
        <li><strong>Deleted Accounts:</strong> When you delete your account, we remove your data within 30 days</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Token Data:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>Access Tokens:</strong> Automatically expire within 1 hour as per Roblox's policy</li>
        <li><strong>Refresh Tokens:</strong> Stored securely until revoked or account deletion</li>
        <li><strong>Session Data:</strong> Expires automatically after 30 days of inactivity</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Deletion Procedures:</h3>
      <p>When you revoke authorization or delete your account:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>We immediately revoke all stored tokens with Roblox</li>
        <li>Your profile data is marked for deletion</li>
        <li>All associated data is permanently removed within 30 days</li>
        <li>Backup systems are purged within 90 days</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">7. Security Measures</h2>
      <p>We implement comprehensive security measures to protect your data:</p>
      
      <h3 class="text-xl font-semibold mb-3">OAuth Security:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>PKCE Implementation:</strong> Proof Key for Code Exchange prevents authorization code interception</li>
        <li><strong>Secure Token Storage:</strong> All tokens are encrypted at rest and in transit</li>
        <li><strong>Token Rotation:</strong> Regular automatic refresh of access tokens</li>
        <li><strong>Scope Limitation:</strong> We request only the minimum necessary permissions</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Technical Safeguards:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>Encryption:</strong> All data is encrypted using industry-standard protocols</li>
        <li><strong>Secure Cookies:</strong> HTTP-only, secure, and SameSite cookie attributes</li>
        <li><strong>HTTPS:</strong> All communications use secure HTTPS connections</li>
        <li><strong>Access Controls:</strong> Strict access controls and authentication for our systems</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Operational Security:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li>Regular security audits and vulnerability assessments</li>
        <li>Monitoring for unauthorized access attempts</li>
        <li>Incident response procedures for security breaches</li>
        <li>Staff training on data protection and privacy practices</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">8. Your Rights</h2>
      <p>You have the following rights regarding your personal data:</p>
      
      <h3 class="text-xl font-semibold mb-3">Access and Control:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>View Your Data:</strong> Request a copy of all data we have about you</li>
        <li><strong>Correct Your Data:</strong> Update or correct inaccurate information</li>
        <li><strong>Delete Your Data:</strong> Request complete deletion of your account and data</li>
        <li><strong>Data Portability:</strong> Receive your data in a machine-readable format</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">Authorization Management:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>Revoke Access:</strong> Remove our application's access through Roblox account settings</li>
        <li><strong>Logout:</strong> End your session and clear local authentication data</li>
        <li><strong>Scope Modification:</strong> Change permissions by re-authorizing with different scopes</li>
      </ul>

      <h3 class="text-xl font-semibold mb-3">How to Exercise Your Rights:</h3>
      <ul class="list-disc pl-6 mb-4">
        <li>Use the logout function in our application</li>
        <li>Revoke authorization in your Roblox account settings</li>
        <li>Contact us directly using the information provided below</li>
        <li>Submit a formal request through our support channels</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
      <p>
        We are committed to protecting the privacy of children and comply with applicable privacy laws:
      </p>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>Age Requirement:</strong> Our service requires users to be at least 13 years old</li>
        <li><strong>COPPA Compliance:</strong> We do not knowingly collect personal information from children under 13</li>
        <li><strong>GDPR Compliance:</strong> We follow GDPR requirements for processing data of minors</li>
        <li><strong>Roblox Alignment:</strong> Our age restrictions align with Roblox's platform requirements</li>
      </ul>
      <p>
        If we become aware that we have collected personal information from a child under 13 without 
        proper consent, we will take immediate steps to delete such information.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">10. International Data Transfers</h2>
      <p>
        Your data may be processed and stored in countries other than your own. We ensure that any 
        international data transfers comply with applicable privacy laws and include appropriate 
        safeguards such as:
      </p>
      <ul class="list-disc pl-6 mb-4">
        <li>Standard contractual clauses approved by relevant authorities</li>
        <li>Adequacy decisions by privacy regulators</li>
        <li>Certification schemes and codes of conduct</li>
        <li>Binding corporate rules where applicable</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">11. Updates to This Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time to reflect changes in our practices, 
        technology, legal requirements, or other factors. We will:
      </p>
      <ul class="list-disc pl-6 mb-4">
        <li>Post the updated policy on this page with a new "Last updated" date</li>
        <li>Notify users of material changes through our application or email</li>
        <li>Provide a summary of significant changes when applicable</li>
        <li>Maintain previous versions for reference when requested</li>
      </ul>
      <p>
        Your continued use of our service after any changes constitutes acceptance of the updated 
        Privacy Policy.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">12. Contact Information</h2>
      <p>
        If you have any questions, concerns, or requests regarding this Privacy Policy or our 
        data practices, please contact us:
      </p>
      <div class="bg-gray-800 p-4 rounded-lg mt-4">
        <p><strong>Email:</strong> privacy@choke.dev</p>
        <p><strong>Website:</strong> <a href="/" class="text-blue-400 hover:text-blue-300">blockateaudiodb.choke.dev</a></p>
        <p><strong>Response Time:</strong> We aim to respond to all privacy inquiries within 30 days</p>
      </div>
      <p class="mt-4">
        For data protection concerns in the EU, you also have the right to contact your local 
        data protection authority.
      </p>
    </section>
  </div>
</div>

<style>
  .prose h1, .prose h2, .prose h3 {
    color: #ffffff;
  }
  
  .prose p, .prose li {
    color: #e5e7eb;
    line-height: 1.7;
  }
  
  .prose a {
    color: #60a5fa;
    text-decoration: underline;
  }
  
  .prose a:hover {
    color: #93c5fd;
  }
  
  .prose ul {
    margin: 1rem 0;
  }
  
  .prose li {
    margin: 0.5rem 0;
  }
  
  .prose strong {
    color: #ffffff;
    font-weight: 600;
  }
  
  .prose h3 {
    font-size: 1.25rem;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
</style>