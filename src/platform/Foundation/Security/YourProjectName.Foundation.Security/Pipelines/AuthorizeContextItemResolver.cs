using Sitecore;
using Sitecore.Configuration;
using Sitecore.Data;
using Sitecore.Data.Items;
using Sitecore.Diagnostics;
using Sitecore.LayoutService.Mvc.ItemResolving;
using Sitecore.LayoutService.Mvc.Pipelines.RequestBegin;
using Sitecore.LayoutService.Mvc.Routing;
using Sitecore.Mvc.Pipelines.Request.RequestBegin;
using System;
using System.Web;
using YourProjectName.Foundation.Security;

namespace YourProjectName.Foundation.SitecoreExtension.Pipelines
{
    public class AuthorizeContextItemResolver : ContextItemResolver
    {
        public AuthorizeContextItemResolver(IItemResolver itemResolver, IRouteMapper routeMapper) : base(itemResolver, routeMapper)
        {
        }

        public override void Process(RequestBeginArgs args)
        {
            base.Process(args);

            if (Context.Site.IsBackend)
            {
                return;
            }

            if (!Settings.AliasesActive)
            {
                return;
            }

            var database = Context.Database;
            if (database == null)
            {
                return;
            }

            if (Context.Item != null)
            {
                
                string jwtToken = GetHttpHeaderValue("Authorization");
                bool isAuthenticated = IsValidToken(jwtToken);

               
                if (!isAuthenticated)
                {
                    Context.Item = Context.Database.GetItem(string.Concat(Context.Site.StartPath, "/UnAuthorizedPage"));
                    args.RequestContext.HttpContext.Response.StatusCode = 401;                   
                    return;
                }

                string path = this.GetPath(args);
                if (string.IsNullOrEmpty(path))
                {
                    return;
                }
                ID targetID = database.Aliases.GetTargetID(path);
                Item item = database.GetItem(targetID);
                Context.Item = item;               
            }
        }

        /// <summary>
        /// GetAuthTokenFromHeader
        /// </summary>
        /// <param name="args"></param>
        /// <returns></returns>
        private static string GetHttpHeaderValue(string key)
        {
            string result = string.Empty;
            try
            {
                result = HttpContext.Current.Request.Headers[key];
            }
            catch (Exception ex) {
                var reflectType = System.Reflection.MethodBase.GetCurrentMethod();
                Log.Error("ERROR:" + reflectType.ReflectedType.Name + reflectType.Name, ex, reflectType);
            }
            return result;
        }

        /// <summary>
        /// IsValidToken
        /// </summary>
        /// <param name="args"></param>
        /// <returns></returns>
        private static bool IsValidToken(string jwtToken)
        {
            bool isValidToken = false;

            try
            {
                AzureAuthorizationGenericWrapper azureAuthorizationWrapper = new AzureAuthorizationGenericWrapper();
                isValidToken = (!string.IsNullOrEmpty(jwtToken)) ? azureAuthorizationWrapper.VerifyJwtToken(jwtToken) : false;
            }
            catch (Exception ex)
            {
                var reflectType = System.Reflection.MethodBase.GetCurrentMethod();
                Log.Error("ERROR:" + reflectType.ReflectedType.Name + reflectType.Name, ex, reflectType);
            }

            return isValidToken;
        }

    }
}