using System;
using System.CommandLine;
using System.CommandLine.Invocation;
using System.IO;
using System.IO.Abstractions;
using System.Linq;
using Cmf.CLI.Constants;
using Cmf.CLI.Core.Attributes;
using Cmf.CLI.Core.Objects;
using Cmf.CLI.Factories;
using Cmf.CLI.Interfaces;
using Cmf.CLI.Utilities;
using Cmf.CLI.Objects;
using Microsoft.Extensions.DependencyInjection;

namespace Cmf.CLI.Commands.restore
{
    /// <summary>
    /// Restore package dependencies (declared cmfpackage.json) from repository packages
    /// </summary>
    [CmfCommand("restore")]
    public class RestoreCommand : BaseCommand
    {
        #region Constructors

        /// <summary>
        /// Restore Command
        /// </summary>
        public RestoreCommand() : base() { }

        /// <summary>
        /// Restore Command
        /// </summary>
        /// <param name="fileSystem"></param>
        public RestoreCommand(IFileSystem fileSystem) : base(fileSystem) { }

        #endregion Constructors

        /// <summary>
        /// Configure the Restore command options and arguments
        /// </summary>
        /// <param name="cmd"></param>
        public override void Configure(Command cmd)
        {
            cmd.AddOption(new Option<Uri[]>(
                aliases: new string[] { "-r", "--repos", "--repo" },
                description: "Repositories where dependencies are located (folder)"));

            var packageRoot = FileSystemUtilities.GetPackageRoot(this.fileSystem);
            var arg = new Argument<IDirectoryInfo>(
                name: "packagePath",
                description: "Package path");
            cmd.AddArgument(arg);

            if (packageRoot != null)
            {
                var packagePath = this.fileSystem.Path.GetRelativePath(this.fileSystem.Directory.GetCurrentDirectory(), packageRoot.FullName);
                arg.SetDefaultValue(this.fileSystem.DirectoryInfo.FromDirectoryName(packagePath));
            }
            cmd.Handler = CommandHandler.Create<IDirectoryInfo, Uri[]>(Execute);
        }

        /// <summary>
        /// Execute the restore command
        /// </summary>
        /// <param name="packagePath">The path of the current package folder</param>
        /// <param name="repos">The package repositories URI/path</param>
        public void Execute(IDirectoryInfo packagePath, Uri[] repos)
        {
            using var activity = ExecutionContext.ServiceProvider?.GetService<ITelemetryService>()?.StartExtendedActivity(this.GetType().Name);
            IFileInfo cmfpackageFile = this.fileSystem.FileInfo.FromFileName($"{packagePath}/{CliConstants.CmfPackageFileName}");
            IPackageTypeHandler packageTypeHandler = PackageTypeFactory.GetPackageTypeHandler(cmfpackageFile, setDefaultValues: false);
            if (repos != null)
            {
                ExecutionContext.Instance.RepositoriesConfig.Repositories.InsertRange(0, repos);
            }
            packageTypeHandler.RestoreDependencies(ExecutionContext.Instance.RepositoriesConfig.Repositories.ToArray());
        }
    }
}