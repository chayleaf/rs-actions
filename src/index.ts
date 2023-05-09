import * as core from '@actions/core';
import * as exec from '@actions/exec';

function getTarget(): string
{
    let target: string = core.getInput('target');

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
        process.exitCode = 1
    }
    return '';
}

async function run() {
    try
    {
        let target: string = getTarget();

        await exec.exec('cargo', ['build', '--release', '--target', target]);
        core.setOutput('output', 'Successfully compiled Rust code.');
    }
    catch (error: any)
    {
        if (error instanceof Error)
            core.setFailed(error.message);
    }
}

run();
