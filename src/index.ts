import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';

async function createRelease(tagName: string, targetCommitish: string, name: string, body: string): Promise<string> {
    const octokit = github.getOctokit(
        core.getInput('github-token', { required: true }));

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

async function uploadAsset(uploadUrl: string, assetPath: string, assetName: string): Promise<void>
{
    const octokit = github.getOctokit(
        core.getInput('github-token', { required: true }));

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

    const os: string = core.getInput('os', { required: true });
    if (os.includes('ubuntu'))
    {
        return 'x86_64-unknown-linux-gnu';
    }
    else if (os.includes('windows'))
    {
        return 'x86_64-pc-windows-msvc';
    }
    else if (os.includes('macos'))
    {
        return 'x86_64-apple-darwin';
    }
    else
    {
        core.setFailed(`Unsupported operating system: ${os}`);
        process.exit();
    }
}

async function run()
{
    try
    {
        const target: string = getTarget();

        await exec.exec('cargo', ['build', '--release', '--target', target]);
        core.setOutput('output', 'Successfully compiled Rust code.');
    }
    catch (error: unknown)
    {
        if (error instanceof Error)
            core.setFailed(error.message);
    }
}

run();
