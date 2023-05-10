import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import * as fs from 'fs/promises';
import * as toml from 'toml'

async function createRelease(tagName: string, targetCommitish: string, name: string, body: string, githubToken: string): Promise<string>
{
    const octokit = github.getOctokit(githubToken, { required: true });

    const createReleaseResponse = await octokit.rest.repos.createRelease({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        tag_name: tagName,
        target_commitish: targetCommitish,
        name: name,
        body: body,
        draft: true,
        prerelease: false,
    });

  return createReleaseResponse.data.upload_url;
}

async function uploadAsset(uploadUrl: string, assetPath: string, assetName: string, githubToken: string): Promise<void>
{
    const octokit = github.getOctokit(
        core.getInput(githubToken, { required: true }));

    const headers = {
        'content-type': 'application/octet-stream',
        'content-length': String(require('fs').statSync(assetPath).size),
    };

    const uploadAssetResponse = await octokit.request({
        method: 'POST',
        url: uploadUrl,
        headers,
        data: require('fs').readFileSync(assetPath),
    });

    if (uploadAssetResponse.status !== 201)
    {
        throw new Error(`Failed to upload asset: ${uploadAssetResponse.status} - ${uploadAssetResponse.data}`);
    }

    core.info(`Uploaded asset ${assetName}`);
}


function getTarget(): string
{
    const target: string = core.getInput('target');

    if (target !== '') return target;

    const os: string = process.platform;
    if (os.includes('linux'))
    {
        return 'x86_64-unknown-linux-gnu';
    }
    else if (os.includes('win32'))
    {
        return 'x86_64-pc-windows-msvc';
    }
    else if (os.includes('darwin'))
    {
        return 'x86_64-apple-darwin';
    }
    else
    {
        core.setFailed(`Unsupported operating system: ${os}`);
        process.exit();
    }
}

async function getVersionFromToml(): Promise<string>
{
    const cargoTomlPath: string = core.getInput('cargo-toml-path');

    try
    {
        const cargoTomlContents: string = await fs.readFile(
            cargoTomlPath !== '' ? cargoTomlPath : 'Cargo.toml',
            { encoding: 'utf8' }
        );
        const cargoToml: any = toml.parse(cargoTomlContents);
        return `v${cargoToml.package.version}`;
    }
    catch (error: any)
    {
        if (error instanceof Error)
            core.setFailed(error.message);
        process.exit();
    }
}


async function run()
{
    try
    {
        const target: string = getTarget();

        await exec.exec('cargo', ['build', '--release', '--target', target]);

        const assetPath = `target/${target}/release/my_rust_binary`;
        const assetName = 'my_rust_binary';

        const publishRelease = core.getInput('publish-release') === 'true';
        if (!publishRelease)
        {
            core.setOutput('output', 'Successfully compiled Rust code.');
            process.exit();
        }

        const githubToken: string | undefined = process.env.GITHUB_TOKEN;
        if (githubToken === undefined)
        {
            core.setFailed("Failed to retrieve github token, please make sure to add GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} to your env tag");
            process.exit();
        }

        const releaseName: string = await getVersionFromToml();

        const uploadUrl = await createRelease(
            releaseName,
            github.context.sha,
            releaseName,
            'Description of the release.',
            githubToken
        );

        await uploadAsset(uploadUrl, assetPath, assetName, githubToken);

        core.setOutput('output', 'Successfully compiled and drafted your Rust code.');

    }
    catch (error: unknown)
    {
        if (error instanceof Error)
            core.setFailed(error.message);
    }
}

run();
