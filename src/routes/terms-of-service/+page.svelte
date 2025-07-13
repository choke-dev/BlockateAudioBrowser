<script lang="ts">
  const lastUpdated = "July 13, 2025";
</script>

<svelte:head>
  <title>Terms of Service - Blockate Audio Database</title>
  <meta name="description" content="Terms of Service for Blockate Audio Database - OAuth-enabled Roblox audio management platform" />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
  <div class="prose prose-invert max-w-none">
    <h1 class="text-4xl font-bold mb-8">Terms of Service</h1>
    
    <p class="text-sm text-gray-400 mb-8">Last updated: {lastUpdated}</p>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">1. Introduction</h2>
      <p>
        Welcome to Blockate Audio Database ("we," "our," or "us"), a web application designed for 
        Roblox players who play "Blockate." Our platform provides audio management and discovery 
        services, enabling users to search, browse, and manage audio content within the ecosystem.
      </p>
      <p>
        This application uses Roblox as an identity provider through OAuth 2.0 authentication. 
        By using our service, you acknowledge that your use is subject to both these Terms of 
        Service and <a href="https://en.help.roblox.com/hc/en-us/articles/115004647846" 
        target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300">
        Roblox's Terms of Service</a>.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">2. Acceptance of Terms</h2>
      <p>
        By accessing or using Blockate Audio Database, you agree to be bound by these Terms of 
        Service and all applicable laws and regulations. If you do not agree with any part of 
        these terms, you may not use our service.
      </p>
      <p>
        <strong>Age Requirement:</strong> You must be at least 13 years old to use this service, 
        in compliance with Roblox's age requirements and applicable privacy laws including COPPA.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">3. Authorization & OAuth Scopes</h2>
      <p>
        Our application requests the following OAuth scopes from your Roblox account:
      </p>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>openid:</strong> Required for user authentication and to receive your unique user identifier</li>
        <li><strong>profile:</strong> Allows us to access your username, display name, and avatar for personalization and account linking</li>
        <li><strong>asset:read:</strong> Enables access to your audio assets to assist with audio selection in whitelist request forms</li>
      </ul>
      <p>
        We follow Roblox's principle of least privilege, requesting only the minimum scopes necessary 
        for our application's functionality. Each scope supports specific features:
      </p>
      <ul class="list-disc pl-6 mb-4">
        <li>User identification and session management</li>
        <li>Displaying the currently logged in account for your convenience</li>
        <li>Linking your Roblox account to your Blockate Audio Database account</li>
        <li>Audio content association with your account for management purposes</li>
        <li>Assisting with audio asset selection when submitting whitelist requests by providing access to your owned audio files</li>
      </ul>
      <p>
        Our application undergoes Roblox's scope review process to ensure compliance with their 
        security and privacy standards.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">4. User Responsibilities</h2>
      <p>As a user of our service, you acknowledge and agree that:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>You own and are responsible for your Roblox account data</li>
        <li>You should carefully review the permissions requested before granting access to our application</li>
        <li>You are responsible for maintaining the security of your Roblox account</li>
        <li>You will use our service in compliance with all applicable laws and Roblox's Terms of Service</li>
        <li>You will not attempt to circumvent our security measures or access unauthorized data</li>
        <li>You will not use our service for any illegal, harmful, or malicious purposes</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">5. Our Responsibilities</h2>
      <p>We are committed to:</p>
      <ul class="list-disc pl-6 mb-4">
        <li><strong>Secure Token Handling:</strong> We implement PKCE (Proof Key for Code Exchange) and follow OAuth 2.0 best practices</li>
        <li><strong>Data Protection:</strong> We do not share client secrets and use secure token storage methods</li>
        <li><strong>Compliance:</strong> Our token storage and handling comply with industry best practices and Roblox's security requirements</li>
        <li><strong>Transparency:</strong> We clearly communicate what data we access and how we use it</li>
        <li><strong>Security:</strong> We implement appropriate technical and organizational measures to protect your data</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">6. Data Use & Limitations</h2>
      <p>We use your Roblox user data solely for the following permitted purposes:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>User authentication and session management</li>
        <li>Personalizing your experience within our application</li>
        <li>Providing audio management and discovery services</li>
        <li>Maintaining application functionality and user preferences</li>
        <li>Assisting with audio asset selection in whitelist request forms by accessing audios that you own</li>
      </ul>
      <p><strong>Prohibited Uses:</strong> We will not:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Sell, rent, or otherwise monetize your Roblox user data</li>
        <li>Share your data with third parties without your explicit consent</li>
        <li>Use your data for purposes beyond those disclosed in our Privacy Policy</li>
        <li>Process your data in ways that violate Roblox's Terms of Service or Developer Terms</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">7. Account Termination</h2>
      <p><strong>User-Initiated:</strong> You may revoke access to our application at any time by:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Using the logout function within our application</li>
        <li>Revoking authorization through your Roblox account settings</li>
        <li>Contacting us directly to request account deletion</li>
      </ul>
      <p><strong>Service-Initiated:</strong> We reserve the right to:</p>
      <ul class="list-disc pl-6 mb-4">
        <li>Suspend or terminate accounts that violate these Terms of Service</li>
        <li>Revoke access tokens for security or compliance reasons</li>
        <li>Delete accounts that remain inactive for extended periods</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">8. Disclaimers & Limitation of Liability</h2>
      <p>
        <strong>Service Availability:</strong> Our service is provided "as is" without warranties of any kind. 
        We do not guarantee uninterrupted or error-free operation.
      </p>
      <p>
        <strong>Limitation of Liability:</strong> To the maximum extent permitted by law, we shall not be 
        liable for any indirect, incidental, special, consequential, or punitive damages, including but 
        not limited to loss of profits, data, or use, arising out of or relating to your use of our service.
      </p>
      <p>
        <strong>Third-Party Services:</strong> We are not responsible for the availability, content, or 
        policies of third-party services, including Roblox's platform and services.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">9. Changes to Terms</h2>
      <p>
        We may update these Terms of Service from time to time. We will notify users of any material 
        changes by posting the new Terms of Service on this page and updating the "Last updated" date. 
        Your continued use of our service after any changes constitutes acceptance of the new terms.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">10. Contact Information</h2>
      <p>
        If you have any questions about these Terms of Service, please contact us at:
      </p>
      <p>
        Email: legal@choke.dev<br>
        Website: <a href="/" class="text-blue-400 hover:text-blue-300">blockateaudiodb.choke.dev</a>
      </p>
    </section>
  </div>
</div>

<style>
  .prose h1, .prose h2 {
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
</style>