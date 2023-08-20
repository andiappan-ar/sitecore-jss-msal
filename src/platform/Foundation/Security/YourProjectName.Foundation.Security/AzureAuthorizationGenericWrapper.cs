using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading;
using System.Web;

namespace YourProjectName.Foundation.Security
{
    public class AzureAuthorizationGenericProps
    {
        public string _audience { get; set; }
        public string _clientId { get; set; }
        public string _tenant { get; set; }
        public string _authority { get; set; }
        public bool _azureAuthorizationEnabled { get; set; }
        public bool _validateAudience { get; set; }     

    }

    public class AzureAuthorizationGenericWrapper
    {
        private string _audience { get; set; }
        private string _clientId { get; set; }
        private string _tenant { get; set; }
        private string _authority { get; set; }
        private bool _azureAuthorizationEnabled { get; set; }
        private bool _validateAudience { get; set; }        
        private ConfigurationManager<OpenIdConnectConfiguration> _configManager;

        public AzureAuthorizationGenericWrapper()
        {
            string keyPrefix = string.Concat("YourProjectName.Foundation.Security.");

            _audience = Sitecore.Configuration.Settings.GetSetting(keyPrefix + "AzureAudience");
            _clientId = Sitecore.Configuration.Settings.GetSetting(keyPrefix + "AzureClientId");
            _tenant = Sitecore.Configuration.Settings.GetSetting(keyPrefix + "AzureTenantId");
            _authority = Sitecore.Configuration.Settings.GetSetting(keyPrefix + "AzureAuthority");
            _azureAuthorizationEnabled = bool.Parse(Sitecore.Configuration.Settings.GetSetting(keyPrefix + "AzureAuthorizationEnabled", "true"));
            _validateAudience = bool.Parse(Sitecore.Configuration.Settings.GetSetting(keyPrefix + "ValidateAudience", "true"));           
        }

        public bool VerifyJwtToken(string JwtToken)
        {
            var request = HttpContext.Current.Request;  
            
            if(!_azureAuthorizationEnabled)
            {
                return true;
            }

            if (string.IsNullOrWhiteSpace(JwtToken))
            {
                return false;
            }

            if (JwtToken.StartsWith("Bearer "))
            {
                JwtToken = JwtToken.Replace("Bearer ", "");
            }

            Microsoft.IdentityModel.Logging.IdentityModelEventSource.ShowPII = true;

            _configManager = new ConfigurationManager<OpenIdConnectConfiguration>($"{_authority}/.well-known/openid-configuration", new OpenIdConnectConfigurationRetriever());

            OpenIdConnectConfiguration config = null;
            IList<string> validissuers = new List<string>()
                                                    {
                                                        $"https://login.microsoftonline.com/{_tenant}/",
                                                        $"https://login.microsoftonline.com/{_tenant}/v2.0",
                                                        $"https://login.windows.net/{_tenant}/",
                                                        $"https://login.microsoft.com/{_tenant}/",
                                                        $"https://sts.windows.net/{_tenant}/"
                                                    };

            ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;

            config = _configManager.GetConfigurationAsync(CancellationToken.None).Result;

            TokenValidationParameters validationParameters = GetTokenValidationParameters(config, validissuers);
            JsonWebTokenHandler tokenHandler = new JsonWebTokenHandler();
            TokenValidationResult result = tokenHandler.ValidateToken(JwtToken, validationParameters);

            if (result.Exception != null && result.Exception is SecurityTokenSignatureKeyNotFoundException)
            {
                _configManager.RequestRefresh();
                config = _configManager.GetConfigurationAsync().Result;
                validationParameters = GetTokenValidationParameters(config, validissuers);

                // attempt to validate token again after refresh
                result = tokenHandler.ValidateToken(JwtToken, validationParameters);
            }

            return (result.Exception == null);
        }

        private TokenValidationParameters GetTokenValidationParameters(OpenIdConnectConfiguration config, IList<string> validissuers)
        {
            TokenValidationParameters validationParameters = new TokenValidationParameters
            {
                ValidateAudience = _validateAudience,
                ValidateIssuer = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidAudiences = new[] { _clientId },
                ValidIssuers = validissuers,
                IssuerSigningKeys = config.SigningKeys
            };

            validationParameters.ValidAudiences = validationParameters.ValidAudiences.Concat(_audience.Split(',').ToList());

            return validationParameters;
        }

    }
}

